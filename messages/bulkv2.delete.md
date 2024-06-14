# summary

Bulk delete records from an org using a CSV file. Uses Bulk API 2.0.

# description

The CSV file must have only one column ("Id") and then the list of record IDs you want to delete, one ID per line.

When you execute this command, it starts a job, displays the ID, and then immediately returns control of the terminal to you by default. If you prefer to wait, set the --wait flag to the number of minutes; if it times out, the command outputs the IDs. Use the job ID to check the status of the job with the "<%= config.bin %> data delete resume" command.

# examples

- Bulk delete Account records from your default org using the list of IDs in the "files/delete.csv" file:

  <%= config.bin %> <%= command.id %> --sobject Account --file files/delete.csv

- Bulk delete records from a custom object in an org with alias my-scratch and wait 5 minutes for the command to complete:

  <%= config.bin %> <%= command.id %> --sobject MyObject__c --file files/delete.csv --wait 5 --target-org my-scratch

# flags.hard-delete.summary

Mark the records as immediately eligible for deletion by your org. If you don't specify this flag, the deleted records go into the Recycle Bin.

# flags.hard-delete.description

You must have the "Bulk API Hard Delete" system permission to use this flag. The permission is disabled by default and can be enabled only by a system administrator.
