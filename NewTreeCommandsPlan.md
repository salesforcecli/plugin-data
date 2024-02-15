# New Data Tree Command Plan

We're improving the `data export tree` and `data import tree` commands, but doing it in phases. 

## Phase 1: Beta the new commands. [Now]

Our plan:

1. Introduce the new `data import beta tree` and `data export beta tree` commands.
1. Both commands use the new helper functions.
1. Update the existing commands' output with a message that encourages users to try the new commands.
2. Ensure that export files created by `data export beta tree` are compatible with both `data import tree` and `data import beta tree`.

These are the breaking changes between the existing and beta commands:

* `data import beta tree`: We removed the hidden and deprecated `--content-type` flag. The command supports only JSON files. Usage of the flag: ~5 per year.
* `data import beta tree`: We removed the `--config-help` flag because the schema information is in the command help. Usage of the flag: ~1 per week.

Other differences:

* `data export tree --plan` uses the object names as the new file name. Previously it appended an `s` on the end, but the new one doesn't. So the filename is now `Account.json` and `Foo__c.json` instead of `Accounts.json` and the awful `Foo__cs.json`.
* `data export beta tree` no longer writes empty child objects. Previously, you saw properties with `{records: []}` that had no effect when imported.
* `data import beta tree --plan` doesn't care about `resolveRefs` and `saveRefs`.
* `data import beta tree --plan` doesn't care about the order of files in your `plan` file. Rather, it defers unresolved references until they're resolved.
* `data export beta tree --plan` now handles more than 2 levels of child objects in a query. It can handle up to 5 levels, which is the SOQL limit.
* Both `data export beta tree` and `data import beta tree` handle objects that refer to objects of the same type. For example, an Account with ParentId that's an Account or a User with Manager that's a User.
* `data import beta tree --plan` handles more than 200 records. It batches them into groups of 200 per object. The new record limit isn't documented; it most likely comes from your operating system call stack depth or other org limits, such as data storage or api call limits. 
* `data import tree` supported plan files where the `files` property could contain objects. It's unclear how those files were generated, but probably not from the `data export tree` command. The new `data import beta tree` command works only with strings and throws an error otherwise.
* `data import beta tree --files` (and not `--plan`) imports the files in parallel. Files can only reference each other if you specify `--plan`. 
* `data import tree` outputs deprecation warnings for both `--content-type` and `--config-help` flags.

## Phase 2: GA the new commands, put the old ones under the `legacy` sub-topic. [July 10, 2024]

Our plan:

1. Pin an issue when the change goes into the release candidate so if users run into problems they can quickly find the `legacy` commands.
1. Move the "old" commands to `legacy` and mark them `hidden` and `deprecated` with the Phase 3 date.
1. Move the `force:` aliases to the new commands.
1. Remove the `beta` sub-topic from the new commands, but keep the `beta` alias so they will still work. Add the `deprecateAliases` property to encourage users to stop using the commands in the `beta` sub-topic.
1. Update `data export tree --plan` to display a warning that the JSON output is going to change after the Phase 3 date. Specifically, the JSON output won't include `saveRefs` and `resolveRefs` information.

## Phase 3: Retire the `legacy` commands and all their dependent code. [Nov 10 2024]
Our plan:
1. Update `data export tree --plan` to stop writing the unused `saveRefs` and `resolveRefs` properties on plan files, and stop returning them in JSON output.
1. Tighten the schema to remove the `object` part of `files`, and remove `saveRefs` and `resolveRefs`.
1. Check messages for any that aren't being used, then remove them.
1. Remove the `beta` alias from `data import tree` and `data export tree`.
1. Update the pinned issue to reflect these changes.

## How Does This Beta->Legacy Thing Work?

Salesforce CLI uses `beta` and `legacy` subtopics to safely introduce beta versions of existing commands and then GA them. This approach allows you to try out the beta, while continuing to use the existing command at the same time. Let's look at an example to see how this works.

* We create and release the `data export beta tree` command, which is similar to the existing `data export tree` command, but with improvements and possibly breaking changes. The two separate commands co-exist, which means if you run `sf commands`, you see both the existing and `beta` command. 
* After the beta period is over, we GA the changes by moving the functionality we added to `data export beta tree` to the "official" `data export tree` command. We also move the functionality in the _old_ `data export tree` to a new command called `data export legacy tree`. We hide and deprecate both the `legacy` and `beta` versions of the command, but alias the `beta` version to the `data export tree` command because they're now the same. If you run `sf commands` you see only the `data export tree` command, although the `legacy` version is still available (but hidden) if you really need it. 
* At some point, we remove the `data export legacy tree` command; we'll warn you, don't worry. We also remove the `beta` alias. 
