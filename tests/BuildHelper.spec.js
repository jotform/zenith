import { run } from '../build/run';
import ConfigHelperInstance from '../build/classes/ConfigHelper';
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

const mockCircularDepProjects = {
    "app1": "packages/apps/app1",
    "app2": "packages/apps/app2"
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
})
