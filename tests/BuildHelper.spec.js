import { run } from '../build/run';
import ConfigHelperInstance from '../build/classes/ConfigHelper';
import BuildHelper from '../build/classes/Builder/BuildHelper';
import { execSync } from 'child_process';
import path from 'path';

const mockArgs = [
    '--target=build',
    '--project=all',
    '--logLevel=1'
]

const mockProjects = {
    "@jotforminc/zenith": ".",
    "@jotforminc/mockProject": "src"
}

describe('BuildHelper tests', () => {
    test('Should throw error when a project is missing package.json', async () => {
        // simulate as if we are running `zenith --target=build --project=all`
        const oldArgs = [...process.argv];
        process.argv = process.argv.slice(0,2).concat(mockArgs);
        ConfigHelperInstance.projects = mockProjects;
        await expect(run()).rejects.toThrow();
        process.argv = [...oldArgs];
    })

    test('Should throw error if there is a circular dependency', async () => {
        process.chdir('tests/__mocks__/mockRepo');
        expect(() => execSync(`pnpm zenith --target=build --project=all`, { cwd: path.join(process.cwd()), encoding: 'utf-8', stdio: 'pipe' })).toThrow();
    })

    test('controlCyclicDependencies throws on explicit dummy cycle (pkg-a <-> pkg-b)', async () => {
        const helper = new BuildHelper('build', '1', false);
        try {
            helper.projects = new Map([
                ['pkg-a', new Set(['pkg-b'])],
                ['pkg-b', new Set(['pkg-a'])],
            ]);
            expect(() => helper.controlCyclicDependencies()).toThrow(/Cyclic dependency found between pkg-a <=> pkg-b/);
        } finally {
            await helper.pool.terminate(true);
        }
    })

    test('controlCyclicDependencies passes for acyclic dummy graph', async () => {
        const helper = new BuildHelper('build', '1', false);
        try {
            helper.projects = new Map([
                ['pkg-a', new Set(['pkg-b'])],
                ['pkg-b', new Set(['pkg-c'])],
                ['pkg-c', new Set()],
            ]);
            expect(() => helper.controlCyclicDependencies()).not.toThrow();
        } finally {
            await helper.pool.terminate(true);
        }
    })
})
