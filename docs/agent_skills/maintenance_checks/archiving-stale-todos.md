# Archiving Stale TODOs

Use this check periodically, or after a run of related work has landed, to keep `docs/todos/` focused on work that is still open.

## Goal

Move completed TODOs out of the active folder, mark stale TODOs complete when the repository proves the work is already done, and keep `docs/todos/_index.md` aligned with the actual active files.

## Why This Matters

The active TODO folder is a planning surface for humans and agents. Stale completed items make the backlog look larger than it is, duplicate IDs make references ambiguous, and missing front matter makes automated checks harder.

## Steps

1. Start with the active TODO inventory.

   ```sh
   find docs/todos -maxdepth 1 -type f -name '*.md' | sort
   ```

2. Check active TODO metadata for obvious bookkeeping problems.

   ```sh
   node <<'NODE'
   const fs = require('fs');
   const path = require('path');
   const dir = 'docs/todos';

   function frontMatter(file) {
     const text = fs.readFileSync(file, 'utf8');
     const match = text.match(/^---\n([\s\S]*?)\n---\n/);
     if (!match) return null;
     const data = {};
     for (const line of match[1].split('\n')) {
       const index = line.indexOf(':');
       if (index === -1) continue;
       data[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
     }
     return data;
   }

   const ids = new Map();
   const problems = [];

   for (const file of fs.readdirSync(dir).filter(name => /^\d+.*\.md$/.test(name))) {
     const data = frontMatter(path.join(dir, file));
     const id = file.match(/^\d+/)?.[0];
     ids.set(id, [...(ids.get(id) || []), file]);

     if (!data) {
       problems.push(`${file}: missing front matter`);
       continue;
     }

     for (const field of ['title', 'priority', 'effort', 'created', 'status', 'completed']) {
       if (!(field in data)) problems.push(`${file}: missing ${field}`);
     }

     if (data.status === 'Completed') problems.push(`${file}: completed but still active`);
     if (data.title === 'null') problems.push(`${file}: null title`);
   }

   for (const [id, files] of ids) {
     if (files.length > 1) problems.push(`duplicate active id ${id}: ${files.join(', ')}`);
   }

   console.log(problems.length ? problems.join('\n') : 'active todo inventory ok');
   NODE
   ```

3. Verify suspicious TODOs against the repository before archiving them.

   Search for the success condition, not just the TODO title. For example:

   ```sh
   rg -n "compileSegment\(" compiler/src
   rg -n "pixelcode|PixelCode|Pixel Code" editor -g '!**/dist/**'
   rg -n "trace-out|--trace|--expr|dump-range" apps/cli/src apps/cli/tests apps/cli/README.md
   ```

4. Check the historical reason when a TODO appears stale.

   ```sh
   git log --follow --format='%cs %h %s' -- docs/todos/<todo-file>.md
   git log --all --format='%cs %h %s' -G '<success-pattern>' -- <relevant-path>
   ```

   Use the commit date that completed the underlying work as the `completed` date when it is clear. If the completion date is unclear, use today's date and leave a note explaining the verification.

5. Archive completed TODOs.

   ```sh
   git mv docs/todos/<todo-file>.md docs/todos/archived/<todo-file>.md
   ```

   Update the archived file front matter:

   ```yaml
   status: Completed
   completed: YYYY-MM-DD
   ```

   Add a short note with the verification evidence, especially for TODOs that were completed by older commits.

6. Normalize active TODOs that remain open.

   Active TODOs should have complete front matter:

   ```yaml
   title: 'TODO: Short title'
   priority: High/Medium/Low
   effort: 2-4h
   created: YYYY-MM-DD
   status: Open
   completed: null
   ```

7. Refresh `docs/todos/_index.md`.

   The active section should list only files currently present directly under `docs/todos/`. Move newly archived items to the completed table with concise notes.

8. Verify the finished inventory.

   Re-run the metadata check from step 2, then check the index against active files:

   ```sh
   node <<'NODE'
   const fs = require('fs');
   const dir = 'docs/todos';
   const index = fs.readFileSync(`${dir}/_index.md`, 'utf8');
   const activeSection = index.split('## Completed TODOs')[0];
   const activeIds = new Set(fs.readdirSync(dir).filter(name => /^\d+.*\.md$/.test(name)).map(name => name.match(/^\d+/)[0]));
   const indexed = [...activeSection.matchAll(/^\|\s*(\d+)\s*\|/gm)].map(match => match[1]);
   const problems = [];

   for (const id of activeIds) {
     if (!indexed.includes(id)) problems.push(`active id ${id} missing from index`);
   }

   for (const id of indexed) {
     if (!activeIds.has(id)) problems.push(`index active id ${id} has no active file`);
   }

   console.log(problems.length ? problems.join('\n') : 'todo index sanity ok');
   NODE
   ```

## Keep Open Or Archive

Keep a TODO open when:

- the source search shows the requested feature, fix, or cleanup is still absent;
- only part of the success criteria is complete;
- the TODO is still blocked on a decision, upstream source, license, or design choice;
- the implementation exists only in archived notes or generated output, not in active source.

Archive a TODO when:

- the file is already marked `status: Completed`;
- every success criterion is satisfied by active source, tests, docs, or configuration;
- the requested API or code path no longer exists, and the repository history shows it was intentionally removed;
- a newer TODO supersedes it and the older file no longer tracks actionable work.

## Review Notes

- Do not archive by title alone. Search the code for the actual behavior or absence that the TODO describes.
- Be conservative with partially completed TODOs. Update notes or success criteria instead of archiving when follow-up work remains.
- Watch for duplicate active numeric IDs after archiving or renaming files.
- Treat `docs/todos/_index.md` as derived bookkeeping: it should not list archived files in the active section.
