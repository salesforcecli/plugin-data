# summary

Bulk import records into a Salesforce object from a CSV file. Uses Bulk API 2.0.

# description

You can use this command to import millions of records into the object from a file in comma-separated values (CSV) format.

All the records in the CSV file must be for the same Salesforce object. Specify the object with the `--sobject` flag.

Bulk imports can take a while, depending on how many records are in the CSV file. If the command times out, or you specified the --async flag, the command displays the job ID. To see the status and get the results of the job, run "sf data import resume" and pass the job ID to the --job-id flag.

For information and examples about how to prepare your CSV files, see "Prepare Data to Ingest" in the "Bulk API 2.0 and Bulk API Developer Guide" (https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_prepare_data.htm).

# examples

- Import Account records from a CSV-formatted file into an org with alias "my-scratch"; if the import doesn't complete in 10 minutes, the command ends and displays a job ID:

  <%= config.bin %> <%= command.id %> --file accounts.csv --sobject Account --wait 10 --target-org my-scratch

- Import asynchronously and use the default org; the command immediately returns a job ID that you then pass to the "sf data import resume" command:

  <%= config.bin %> <%= command.id %> --file accounts.csv --sobject Account --async

# flags.async.summary

Don't wait for the command to complete.

# flags.file.summary

CSV file that contains the Salesforce object records you want to import.

# flags.sobject.summary

API name of the Salesforce object, either standard or custom, into which you're importing records.

# flags.wait.summary

Time to wait for the command to finish, in minutes.

# flags.line-ending.summary

Line ending used in the CSV file. Default value on Windows is `CRLF`; on macOS and Linux it's `LR`.

# export.resume

Run "sf data import resume --job-id %s" to resume the operation.

# error.timeout

The operation timed out after %s minutes.

Run "sf data import resume --job-id %s" to resume it.

# error.failedRecordDetails

Job finished being processed but failed to import %s records.

To review the details of this job, run this command:

sf org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F%s"

# error.jobFailed

Job failed to be processed due to:

%s

To review the details of this job, run this command:

sf org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F%s"

# error.jobAborted

Job has been aborted.

To review the details of this job, run this command:

sf org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F%s"
