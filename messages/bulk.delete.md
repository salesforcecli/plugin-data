# summary

Bulk delete records from an org using a CSV file. Uses Bulk API 1.0.

# description

The CSV file must have only one column ("Id") and then the list of record IDs you want to delete, one ID per line.

When you execute this command, it starts a job and one or more batches, displays their IDs, and then immediately returns control of the terminal to you by default. If you prefer to wait, set the --wait flag to the number of minutes; if it times out, the command outputs the IDs. Use the job and batch IDs to check the status of the job with the "<%= config.bin %> force data bulk status" command. A single job can contain many batches, depending on the length of the CSV file.

# examples

- Bulk delete Account records from your default org using the list of IDs in the "files/delete.csv" file:

  <%= config.bin %> <%= command.id %> --sobject Account --file files/delete.csv

- Bulk delete records from a custom object in an org with alias my-scratch and wait 5 minutes for the command to complete:

  <%= config.bin %> <%= command.id %> --sobject MyObject__c --file files/delete.csv --wait 5 --target-org my-scratch

# flags.sobject.summary

API name of the Salesforce object, either standard or custom, that you want to delete records from.

# flags.file.summary

CSV file that contains the IDs of the records to delete.

# flags.wait.summary

Number of minutes to wait for the command to complete before displaying the results.
