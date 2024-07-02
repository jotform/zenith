import { readFile } from "fs/promises";
import { createServer } from "http";
import { exec } from 'child_process';
import path from "path";

const PUBLIC_PATH = path.normalize(`${__dirname}/../../../../public`)
const PORT = 8000;

class Server {
  async handleIndex(response) {
    const html = (await readFile(path.normalize(`${PUBLIC_PATH}/index.html`), 'utf-8')).replace('{DATA}', JSON.stringify(this.data));
    response.write(html);
    response.end();
  }

  async serveStatic(url, response) {
    const content = (await readFile(path.normalize(`${PUBLIC_PATH}${url}`)));
    response.write(content);
    response.end();
  }

  constructor(data) {
    this.data = {...data};
  }

  createServer() {
    const server = createServer();
    server.on('request', async (request, response) => {
      if (request.url.endsWith('.js') || request.url.endsWith('.css')) {
        await this.serveStatic(request.url, response);
        return;
      }
      await this.handleIndex(response);
    });
    server.listen(PORT);
    console.log(`Graph server running at port ${PORT}`);
    const start = (process.platform == 'darwin'? 'open': process.platform == 'win32'? 'start': 'xdg-open');
    exec(`${start} http://localhost:${PORT}/`);
  }
}

export default Server;
