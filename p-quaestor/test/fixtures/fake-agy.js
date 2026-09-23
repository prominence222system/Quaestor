'use strict';
// Fake `agy` child process used by test/agy-usage.test.js to exercise
// lib/agy-usage.js across a real process/pipe boundary. Not a *.test.js
// file, so test/run-all.js does not load it as a test.
//
// Mode is selected via process.env.FAKE_AGY_MODE. Argument-fixing is
// enforced here: if argv isn't exactly ['-p', '/usage'], write nothing and
// exit 3 -- see output/DESIGN.md D2.

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '-p' || args[1] !== '/usage') {
  process.exit(3);
}

const mode = process.env.FAKE_AGY_MODE || 'pipe';

const PIPE_TEXT =
  'Gemini Models\tWeekly Limit Remaining\t45%\t2026-09-23T06:57:36Z\n' +
  'Gemini Models\tFive Hour Limit Remaining\t100%\t2026-09-23T05:53:40Z\n' +
  'Claude and GPT models\tWeekly Limit Remaining\t100%\t2026-09-30T00:53:40Z\n' +
  'Claude and GPT models\tFive Hour Limit Remaining\t100%\t2026-09-23T05:53:40Z\n';

const CONSOLE_TEXT =
  'Quota:\n' +
  'Gemini Models          Weekly Limit Remaining     51%   2026-09-23T06:57:36Z\n' +
  'Gemini Models          Five Hour Limit Remaining  89%   2026-09-22T11:07:46Z\n' +
  'Claude and GPT models  Weekly Limit Remaining     100%  2026-09-29T06:24:22Z\n' +
  'Claude and GPT models  Five Hour Limit Remaining  100%  2026-09-22T11:24:22Z\n';

// Gemini values here deliberately avoid the digit substrings "37"/"23" and
// the "2031-01-01"/"2032-02-02" dates used by the sentinel rows below --
// otherwise a coincidental substring match (e.g. day-of-month "23") would
// produce a false positive in the leak check.
const SENTINEL_TEXT =
  'Gemini Models\tWeekly Limit Remaining\t45%\t2026-09-20T06:57:36Z\n' +
  'Gemini Models\tFive Hour Limit Remaining\t88%\t2026-09-20T05:53:40Z\n' +
  'Claude and GPT models\tWeekly Limit Remaining\t37%\t2031-01-01T00:00:00Z\n' +
  'Claude and GPT models\tFive Hour Limit Remaining\t23%\t2032-02-02T00:00:00Z\n';

const LOGIN_TEXT = 'Error: Please sign in to use agy.\n';

switch (mode) {
  case 'pipe':
    process.stdout.write(PIPE_TEXT);
    process.exit(0);
    break;
  case 'console':
    process.stdout.write(CONSOLE_TEXT);
    process.exit(0);
    break;
  case 'sentinel':
    process.stdout.write(SENTINEL_TEXT);
    process.exit(0);
    break;
  case 'empty':
    process.exit(0);
    break;
  case 'login0':
    process.stdout.write(LOGIN_TEXT);
    process.exit(0);
    break;
  case 'login1':
    process.stdout.write(LOGIN_TEXT);
    process.exit(1);
    break;
  case 'hang':
    setTimeout(() => {}, 60000);
    break;
  default:
    process.exit(0);
}
