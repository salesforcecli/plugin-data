# summary

Get the results of a bulk ingest job that you previously ran.

# description

Use this command to get the complete results after running one of the CLI commands that uses Bulk API 2.0 to ingest (import, update, upsert, or delete) large datasets to your org, such as "data import bulk". The previously-run bulk command must have completed; if it's still processing, run the corresponding resume command first, such as "data import resume." Make note of the job ID of the previous bulk command because you use it to run this command. 

You can also use this command to get results from running a bulk ingest job with a different tool, such as Data Loader, as long as you have the job ID. For information on Data Loader, see https://developer.salesforce.com/docs/atlas.en-us.dataLoader.meta/dataLoader/data_loader_intro.htm. 

This command first displays the status of the previous bulk job, the operation that was executed in the org (such as insert or hard delete), and the updated Salesforce object. The command then displays how many records were processed in total, and how many were successful or failed. Finally, the output displays the names of the generated CSV-formatted files that contain the specific results for each ingested record. Depending on the success or failure of the bulk command, the results files can include the IDs of inserted records or the specific errors. When possible, if the ingest job failed or was aborted, you also get a CSV file with the unprocessed results.

# flags.job-id.summary

Job ID of the bulk job.

# examples

- Get results from a bulk ingest job; use the org with alias "my-scratch":

  <%= config.bin %> <%= command.id %> --job-id 7507i000fake341G --target-org my-scratch

# error.jobInProgress

Job hasn't finished being processed yet.

# error.invalidId

Can't find a bulk job with ID %s.

# error.invalidId.actions

- Ensure the ID is from a previously run bulk ingest job, and not a query job.

- Run this command and verify that the job ID for the bulk command exists in your org:

sf org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F750"

# error.noRecords

Unable to get results because the job processed 0 records.
