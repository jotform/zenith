import Cacher from "./Cacher";
import RemoteCacher from "./RemoteCacher";
import LocalCacher from "./LocalCacher";
import { Readable } from "stream";
import { DebugJSON } from "../../types/ConfigTypes";
import Logger from "../../utils/logger";
import Hasher from "../Hasher";

export default class HybridCacher implements Cacher {
    cachePath = '';
    cachers: Cacher[] = [];
    hasher = new Hasher();

    constructor(type: 'local-first' | 'remote-first') {
        if (type === 'local-first') {
            this.cachers = [new LocalCacher(), new RemoteCacher()];
        }
        if (type === 'remote-first') {
            this.cachers = [new RemoteCacher(), new LocalCacher()];
        }
    }

    async putObject({ Bucket, Key, Body }: { Bucket?: string | undefined, Key: string; Body: string | Buffer }): Promise<void> {
        await Promise.all(this.cachers.map(cacher => cacher.putObject({ Bucket, Key, Body })));
    }

    async getObject({ Bucket, Key }: { Bucket?: string | undefined, Key: string }): Promise<Readable> {
        for (const cacher of this.cachers) {
            const object = await cacher.getObject({ Bucket, Key });
            if (object instanceof Readable) {
                return object;
            }
        }
        throw new Error(`Could not find ${Key} in cache`);
    }

    isHybrid() {
        return true;
    }

    isDebug() {
        return process.env.ZENITH_CACHE_DEBUG === 'true';
    }

    async getDebugFile(compareWith: string, target: string, debugLocation: string): Promise<Record<string, string>> {
        for (const cacher of this.cachers) {
            const debugFile = await cacher.getDebugFile(compareWith, target, debugLocation);
            if (debugFile) {
                return debugFile;
            }
        }
        throw new Error(`Could not find debug file for ${compareWith}`);
    }

    updateDebugFile(debugJSON: DebugJSON, target: string, debugLocation: string): void {
        for (const cacher of this.cachers) {
            cacher.updateDebugFile(debugJSON, target, debugLocation);
        }
    }

    async sendOutputHash(hash: string, root: string, output: string, target: string): Promise<void> {
        await Promise.all(this.cachers.map(cacher => cacher.sendOutputHash(hash, root, output, target)));
    }

    callback({
        successMessage,
        resolve,
        reject
    } : {
        successMessage: string,
        resolve?: (value: void | PromiseLike<void>) => void,
        reject?: (reason?: unknown) => void
    }) : (err: Error | null) => void {
        return (err: Error | null) => {
            if (err) {
                reject?.(err);
            } else {
                Logger.log(3, successMessage);
                resolve?.();
            }
        };
    }

    async cacheZip(cachePath: string, output: string, directoryPath: string): Promise<void> {
        await Promise.all(this.cachers.map(cacher => cacher.cacheZip(cachePath, output, directoryPath)));
    }

    async cacheTxt(cachePath: string, output: string, commandOutput: string): Promise<void> {
        await Promise.all(this.cachers.map(cacher => cacher.cacheTxt(cachePath, output, commandOutput)));
    }

    async cache(hash: string, root: string, output: string, target: string, commandOutput: string, requiredFiles: string[] | undefined): Promise<void> {
        await Promise.all(this.cachers.map(cacher => cacher.cache(hash, root, output, target, commandOutput, requiredFiles)));
    }

    async cacheToOther(hash: string, root: string, output: string, target: string, outputHash: string | boolean | void): Promise<void> {
        for (const cacher of this.cachers) {
            try {
                    // TODO: required file handling
                    await cacher.cache(hash, root, output, target, outputHash as string, []);
                    await cacher.sendOutputHash(hash, root, output, target);
            } catch (error) {
                Logger.log(2, error);
            }
        }
    }

    async pipeEnd(stream: Readable, outputPath: string): Promise<string> {
        try {
            return await this.cachers[0].pipeEnd(stream, outputPath);
        } catch (error) {
            return await this.cachers[1].pipeEnd(stream, outputPath);
        }
    }

    async txtPipeEnd(stream: Readable): Promise<string> {
        try {
            return await this.cachers[0].txtPipeEnd(stream);
        } catch (error) {
            return await this.cachers[1].txtPipeEnd(stream);
        }
    }

    async recoverFromCache(originalHash: string, root: string, output: string, target: string, logAffected: boolean): Promise<string | void> {
        for (const cacher of this.cachers) {
            const isRecovered = await cacher.recoverFromCache(originalHash, root, output, target, logAffected);
            if (isRecovered) {
                return isRecovered as string;
            }
        }
        throw new Error(`Could not recover ${root} from cache`);
    }

    async checkHashes(hash: string, root: string, output: string, target: string): Promise<Readable | undefined> {
        try {
            return await this.cachers[0].checkHashes(hash, root, output, target);
        } catch (error) {
            return await this.cachers[1].checkHashes(hash, root, output, target);
        }
    }
}
