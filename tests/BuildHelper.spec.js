import { run } from '../build/run';
import ConfigHelperInstance from '../build/classes/ConfigHelper';

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
})
