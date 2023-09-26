import Cacher from "./Cacher";
import RemoteCacher from "./RemoteCacher";
import LocalCacher from "./LocalCacher";
import { Readable } from "stream";
import { DebugJSON } from "../../types/ConfigTypes";

export default class MixedCacher implements Cacher {
    cachePath = '';
    localCacher: LocalCacher;
    remoteCacher: RemoteCacher;

    constructor() {
        this.localCacher = new LocalCacher();
        this.remoteCacher = new RemoteCacher();
    }

    async putObject({ Bucket, Key, Body }: { Bucket?: string | undefined, Key: string; Body: string | Buffer }): Promise<void> {
        await this.remoteCacher.putObject({ Bucket, Key, Body });
        await this.localCacher.putObject({ Key, Body });
    }

    async getObject({ Bucket, Key }: { Bucket?: string | undefined, Key: string }): Promise<Readable> {
        try {
            return await this.localCacher.getObject({ Key });
        } catch (error) {
            return await this.remoteCacher.getObject({ Bucket, Key });
        }
    }

    async listObjects({ Bucket, Prefix}: {Bucket?: string, Prefix: string}): Promise<string[]> {
        const localFiles = await this.localCacher.listObjects({ Prefix });
        const remoteFiles = await this.remoteCacher.listObjects({ Bucket, Prefix });
        return [...new Set([...localFiles, ...remoteFiles])];
    }

    async getDebugFile(compareWith: string, target: string, debugLocation: string): Promise<Record<string, string>> {
        return await this.remoteCacher.getDebugFile(compareWith, target, debugLocation);
    }

    updateDebugFile(debugJSON: DebugJSON, target: string, debugLocation: string): void {
        this.remoteCacher.updateDebugFile(debugJSON, target, debugLocation);
    }

    async sendOutputHash(hash: string, root: string, output: string, target: string): Promise<void> {
        await this.remoteCacher.sendOutputHash(hash, root, output, target);
        await this.localCacher.sendOutputHash(hash, root, output, target);
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
                console.log(successMessage);
                resolve?.();
            }
        };
    }

    async cacheZip(cachePath: string, output: string, directoryPath: string): Promise<void> {
        await this.remoteCacher.cacheZip(cachePath, output, directoryPath);
        await this.localCacher.cacheZip(cachePath, output, directoryPath);
    }

    async cacheTxt(cachePath: string, output: string, commandOutput: string): Promise<void> {
        await this.remoteCacher.cacheTxt(cachePath, output, commandOutput);
        await this.localCacher.cacheTxt(cachePath, output, commandOutput);
    }

    async cache(hash: string, root: string, output: string, target: string, commandOutput: string, requiredFiles: string[] | undefined): Promise<void> {
        await this.remoteCacher.cache(hash, root, output, target, commandOutput, requiredFiles);
        await this.localCacher.cache(hash, root, output, target, commandOutput, requiredFiles);
    }

    async pipeEnd(stream: Readable, outputPath: string): Promise<string> {
        return await this.localCacher.pipeEnd(stream, outputPath);
    }

    async txtPipeEnd(stream: Readable): Promise<string> {
        return await this.localCacher.txtPipeEnd(stream);
    }

    async recoverFromCache(originalHash: string, root: string, output: string, target: string, logAffected: boolean): Promise<string | void> {
        try {
            return await this.localCacher.recoverFromCache(originalHash, root, output, target, logAffected);
        } catch (error) {
            return await this.remoteCacher.recoverFromCache(originalHash, root, output, target, logAffected);
        }
    }

    async isCached(hash: string, root: string, outputs: string[], target: string): Promise<boolean> {
        const isLocalCached = await this.localCacher.isCached(hash, root, outputs, target);
        if (isLocalCached) return true;
        const isRemoteCached = await this.remoteCacher.isCached(hash, root, outputs, target);
        return isRemoteCached;
    }

    async checkHashes(hash: string, root: string, output: string, target: string): Promise<Readable | undefined> {
        try {
            return await this.localCacher.checkHashes(hash, root, output, target);
        } catch (error) {
            return await this.remoteCacher.checkHashes(hash, root, output, target);
        }
    }
}