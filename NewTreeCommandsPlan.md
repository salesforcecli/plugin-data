# New Tree Commands Plan

## Phase 1: Beta

1. `data import beta tree` and `data export beta tree`
1. both use new helper functions
1. existing commands encourage users to try the new ones

Breaking changes between existing and beta

1. `import beta` removes its hidden, deprecated `content-type`. Only json files are supported. Usage: ~5 per year.
1. `import beta` removes the `--config-help` flag. The schema stuff is in the command help. Usage: ~1 per week.

Other differences

1. `export --plan` writes Object names as the file name. It used to append an `s` on the end. So the filename is now `Account.json` and `Foo__c.json` instead of `Accounts.json` and the awful `Foo__cs.json`
1. `export beta` no longer writes empty child objects. Previously, you'd see properties with `{records: []}` that had no effect on imports.
1. `import beta` with `--plan` does not care about `resolveRefs` and `saveRefs`
1. `import beta` with `--plan` does not care about the order of files in your `plan` file. It'll defer unresolved references until they're resolved.
1. `export beta` now handles more than 2 levels of child objects in a query using `--plan` (up to 5, that's the SOQL limit)
1. both `export beta` and `import beta` handle objects that refer to objects of the same type (ex: Account with ParentId, User with Manager)
1. `import beta` using `--plan` handles more than 200 records. It will batch them into groups of 200 per object. The new record limit is not documented--it most likely comes from your OS call stack depth or other org limits (data storage, api call limits)
1. `import` supported plan files where the `files` property could contain objects. I'm really not sure how those files were generated, but I don't think the export command made them. For `import beta` only work with strings and will throw an error otherwise.
1. `import beta` in `--files` mode (not `--plan`) will import the files in parallel (files can't reference each other without `--plan`)
1. `import` provides deprecation warnings for both `content-type` and `config-help` flags

Export files created by `export beta` are compatible with `import` and `import beta`

## Phase 2: GA the new commands, put the old under `legacy`. [July 10 2024]

1. pin an issue when then change goes into RC so people with problems can quickly find legacy commands
1. move the "old" commands to `legacy` and mark them `hidden` and `deprecated` with the Phase 3 date
1. move the `force:` aliases to the new commands
1. move the new commands to not be `beta` but have the `beta` alias. add `deprecateAliases` so people stop using the `beta` thing.
1. change `export` with `--json` to warn that it will change json output (stop returning the saveRefs/resolveRefs) after Phase 3 date

## Phase 3: retire the legacy commands and all their dependent code [Nov 10 2024]

1. make `export` stop writing the unused `saveRefs` and `resolveRefs` properties on plan files, and stop returning them in json
1. tighten schema to remove the `object` part of `files`, and remove `saveRefs` and `resolveRefs`
1. check messages for unused messages
1. remove the `beta` alias from `import|export`
1. update the pinned issue to reflect these changes