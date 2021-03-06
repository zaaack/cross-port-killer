#!/usr/bin/env node

import { spawn, spawnSync } from "child_process";

export class Killer {

    private platform: string;
    private platforms = {
        win32: { command: 'Taskkill', args: ['/F', '/PID'] },
        linux: { command: 'kill', args: ['-9'] },
        darwin: { command: 'kill', args: ['-9'] },
    }

    constructor(platform: string) {
        this.platform = platform
    }

    public kill(port: number|string): Promise<string[]|null> {
        return this[this.platform](port)
    }

    public killByPid(pid: string): Promise<string[]> {
        return this.killByPids([pid])
    }

    public killByPids(pids: string[]): Promise<string[]> {

        const { command, args } = this.platforms[process.platform]

        let result = pids.filter(pid => {
            return spawnSync(command, args.concat(pid)).status === 0
        })

        return Promise.resolve(result)

    }

    private darwin(port: number): Promise<string[]|null> {
        return this.linux(port)
    }

    private linux(port: number): Promise<string[]|null> {

        let resolver;
        let promise = new Promise(resolve => {
            resolver = resolve
        })

        const lsof = spawn('lsof', ['-s', 'TCP:LISTEN', '-i', ':' + port])
        const awk = spawn('awk', ['\$8 == "TCP" { print $2 }'], { stdio: [lsof.stdout] })

        let result = '';

        awk.stdout.on('data', data => result += data);
        awk.on('close', () => this.parse(result, resolver));
        awk.stdin.end();

        return promise

    }

    private win32(port: number): Promise<string[]|null> {

        let resolver;
        let promise = new Promise(resolve => {
            resolver = resolve
        })

        const findstr = spawn('findstr', [`:${port}.*LISTENING`], { stdio: ['pipe'] })
        const netstat = spawn('netstat', ['-ano'], { stdio: ['ignore', findstr.stdin] })

        let result = '';

        findstr.stdout.on('data', data => result += data);
        findstr.on('close', () => this.parse(result, resolver));
        findstr.stdin.end();

        return promise

    }

    private parse(data, resolver) {

        const pids = data.trim().match(/\d+$/mg)

        if (pids && pids.length) {
            return this.killByPids(pids).then(killed => resolver(killed))
        }

        resolver([])

    }

}
