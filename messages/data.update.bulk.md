# summary

Bulk update records to an org from a CSV file. Uses Bulk API 2.0.

# description

You can use this command to update millions of Salesforce object records based on a file in comma-separated values (CSV) format.

All the records in the CSV file must be for the same Salesforce object. Specify the object with the `--sobject` flag. The first column of every line in the CSV file must be an ID of the record you want to update. The CSV file can contain only existing records; if a record in the file doesn't currently exist in the Salesforce object, the command fails. Consider using "sf data upsert bulk" if you also want to insert new records.

Bulk updates can take a while, depending on how many records are in the CSV file. For this reason, the command is asynchronous by default and immediately displays the "sf data update resume" command that you run to see the status and get the results of the job; the command includes the job ID. You can use the --wait flag to wait a specific number of minutes for this command to complete.

For information and examples about how to prepare your CSV files, see "Prepare Data to Ingest" in the "Bulk API 2.0 and Bulk API Developer Guide" (https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_prepare_data.htm).

# examples

- Update Account records from a CSV-formatted file into an org with alias "my-scratch"; if the update doesn't complete in 10 minutes, the command ends and displays a job ID:

  <%= config.bin %> <%= command.id %> --file accounts.csv --sobject Account --wait 10 --target-org my-scratch

- Update asynchronously and use the default org; the command immediately returns a job ID that you then pass to the "sf data update resume" command:

  <%= config.bin %> <%= command.id %> --file accounts.csv --sobject Account

# flags.wait.summary

Time to wait for the command to finish, in minutes.

# flags.file.summary

CSV file that contains the Salesforce object records you want to update.

# flags.sobject.summary

API name of the Salesforce object, either standard or custom, which you are updating.
