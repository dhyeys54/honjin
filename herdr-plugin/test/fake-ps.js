#!/usr/bin/env node
// Stand-in for `ps -A -o pid=,ppid=,comm=`, driven by the same state file as
// fake-herdr.js:  state.ps = [{ pid, ppid, comm }]; state.psFail = true makes it fail.
const fs = require("node:fs");

const state = JSON.parse(fs.readFileSync(process.env.FAKE_HERDR_STATE, "utf8"));
if (state.psFail) {
  process.stderr.write("ps: fake failure\n");
  process.exit(1);
}
for (const p of state.ps || []) process.stdout.write(`${p.pid} ${p.ppid} ${p.comm}\n`);
