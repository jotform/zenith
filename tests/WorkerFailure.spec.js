import path from 'path';
import os from 'os';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { ZenithCommandError, toZenithCommandError, fromWorkerError, formatFailureBlock } from '../build/utils/errors';
import WorkerHelper from '../build/classes/WorkerHelper';
import BuildHelper from '../build/classes/Builder/BuildHelper';

/** workerpool/src/worker.js — how a thrown error is packed before postMessage. */
const convertError = (error) => Object.getOwnPropertyNames(error).reduce((product, name) => (
    Object.defineProperty(product, name, { value: error[name], enumerable: true })
), {});

/** workerpool/src/WorkerHandler.js — how the parent unpacks it. Prototype is lost here. */
const objectToError = (obj) => {
    const temp = new Error('');
    Object.keys(obj).forEach(key => { temp[key] = obj[key]; });
    return temp;
};

const makeExecError = () => {
    const error = new Error('Command failed: pnpm --filter app1 build');
    error.status = 2;
    error.signal = null;
    error.pid = 1234;
    error.output = [null, 'TS2304: Cannot find name foo\n', ''];
    error.stdout = 'TS2304: Cannot find name foo\n';
    error.stderr = 'compilation failed\n';
    return error;
};

describe('Worker failure reporting', () => {
    test('toZenithCommandError keeps exit code and captured output of a failed command', () => {
        const failure = toZenithCommandError(makeExecError(), {
            project: 'app1', script: 'build', command: 'pnpm --filter app1 build', cwd: '/repo', phase: 'execute'
        });

        expect(failure).toBeInstanceOf(ZenithCommandError);
        expect(failure.project).toBe('app1');
        expect(failure.exitCode).toBe(2);
        expect(failure.stdout).toContain('TS2304: Cannot find name foo');
        expect(failure.stderr).toContain('compilation failed');
    });

    test('formatFailureBlock reports project, command, exit code and both streams', () => {
        const block = formatFailureBlock(toZenithCommandError(makeExecError(), {
            project: 'app1', script: 'build', command: 'pnpm --filter app1 build', cwd: '/repo', phase: 'execute'
        }));

        expect(block).toContain('Zenith failed: app1');
        expect(block).toContain('(target: build)');
        expect(block).toContain('pnpm --filter app1 build');
        expect(block).toContain('exit code: 2');
        expect(block).toContain('--- stdout ---');
        expect(block).toContain('TS2304: Cannot find name foo');
        expect(block).toContain('--- stderr ---');
        expect(block).toContain('compilation failed');
    });

    test('failure details survive the workerpool serialization round trip', () => {
        const thrown = toZenithCommandError(makeExecError(), {
            project: 'app1', script: 'build', command: 'pnpm --filter app1 build', cwd: '/repo', phase: 'execute'
        });

        // Prototype is gone after the round trip, so instanceof cannot be relied on.
        const received = objectToError(convertError(thrown));
        expect(received).not.toBeInstanceOf(ZenithCommandError);

        const rehydrated = fromWorkerError(received, { project: 'app1', script: 'build', phase: 'execute' });
        expect(rehydrated).toBeInstanceOf(ZenithCommandError);
        expect(rehydrated.message).toBe('Command failed: pnpm --filter app1 build');
        expect(rehydrated.exitCode).toBe(2);
        expect(rehydrated.stdout).toContain('TS2304: Cannot find name foo');
        expect(rehydrated.stderr).toContain('compilation failed');
        expect(formatFailureBlock(rehydrated)).toContain('exit code: 2');
    });

    test('formatFailureBlock falls back to the stack for a plain error', () => {
        expect(formatFailureBlock(new Error('something broke'))).toContain('something broke');
        expect(formatFailureBlock('not an error')).toBe('Zenith failed: not an error');
    });

    describe('against a real worker thread', () => {
        // Self-contained fixture: running pnpm inside tests/__mocks__/mockRepo would
        // trip its workspace dependency check, which needs the network.
        let fixture;

        beforeAll(() => {
            fixture = mkdtempSync(path.join(os.tmpdir(), 'zenith-failure-fixture-'));
            // Both scripts exit non-zero on purpose: a successful run would cache its
            // output, and a worker thread does not see jest's sandboxed process.env,
            // so LOCAL_CACHE_PATH cannot redirect those writes out of the repo.
            writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({
                name: 'failure-fixture',
                version: '1.0.0',
                scripts: {
                    boom: 'node -e "console.log(\'TS2304: Cannot find name foo\'); process.exit(3)"',
                    slow: 'node -e "setTimeout(() => process.exit(1), 1500)"'
                }
            }));
        });

        afterAll(() => {
            rmSync(fixture, { recursive: true, force: true });
        });

        test('a failing command surfaces its own output, not a worker termination message', async () => {
            const helper = new WorkerHelper('boom', '1');

            try {
                const failure = await helper.executeManual({ cwd: fixture, command: 'boom', hash: 'no-hash' })
                    .then(() => null, error => error);

                expect(failure).toMatchObject({
                    name: 'ZenithCommandError',
                    phase: 'manual',
                    exitCode: 3,
                    command: 'pnpm run boom'
                });
                expect(failure.stdout).toContain('TS2304: Cannot find name foo');

                const block = formatFailureBlock(failure);
                expect(block).toContain('exit code: 3');
                expect(block).toContain('TS2304: Cannot find name foo');
                expect(block).not.toContain('Workerpool Worker terminated Unexpectedly');
                expect(block).not.toContain('Executing worker failed');
            } finally {
                await helper.pool.terminate(true);
            }
        }, 60000);

        // A WorkerHandler holds a single termination callback slot, so concurrent
        // graceful terminates overwrite each other and every caller but the last
        // waits on a promise that never settles. Every failing project calls
        // shutdown, so without memoization the whole run hangs and exits silently.
        test('concurrent shutdowns all settle while workers are busy', async () => {
            const helper = new BuildHelper('slow', '2', false);

            try {
                const busy = [
                    helper.executeManual({ cwd: fixture, command: 'slow', hash: 'hash-a' }).catch(() => null),
                    helper.executeManual({ cwd: fixture, command: 'slow', hash: 'hash-b' }).catch(() => null)
                ];

                const shutdowns = [helper.shutdown(), helper.shutdown(), helper.shutdown()];

                let timer;
                const outcome = await Promise.race([
                    Promise.all(shutdowns).then(() => 'settled'),
                    new Promise(resolve => { timer = setTimeout(() => resolve('hung'), 15000); })
                ]);
                clearTimeout(timer);
                expect(outcome).toBe('settled');
                expect(shutdowns[1]).toBe(shutdowns[0]);
                await Promise.all(busy);
            } finally {
                await helper.pool.terminate(true);
            }
        }, 60000);
    });
});
