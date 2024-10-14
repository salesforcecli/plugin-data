# summary

Bulk import records to an org from a CSV file. Uses Bulk API 2.0.

# description

You can use this command to import millions of records to an org from a CSV file.

All the records in the CSV file must be for the same object, you specify the object being imported via the `--sobject` flag.

More info about how to prepare CSV files:
https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_prepare_csv.htm

# examples

- Import Account records from a CSV-formatted file into an org.

  <%= config.bin %> <%= command.id %> --file accounts.csv --sobject Account --wait 10 --target-org my-scratch

- Import asynchronously; the command immediately returns a job ID that you then pass to the "sf data import resume" command:

  <%= config.bin %> <%= command.id %> --file accounts.csv --sobject Account --async --target-org my-scratch

# flags.async.summary

Run the command asynchronously.

# flags.file.summary

CSV file that contains the fields of the object to import.

# flags.sobject.summary

API name of the Salesforce object, either standard or custom, that you want to import to the org.

# flags.wait.summary

Time to wait for the command to finish, in minutes.

# export.resume

Run "sf data import resume --job-id %s" to resume the operation.

# error.timeout

The operation timed out after %s minutes.

Run "sf data import resume --job-id %s" to resume it.

# error.failedRecordDetails

Job finished being processed but failed to import %s records.

To review the details of this job, run:
sf org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F%s"

# error.jobFailed

Job failed to be processed due to:
%s

To review the details of this job, run:
sf org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F%s"

# error.jobAborted

Job has been aborted.

To review the details of this job, run:
sf org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F%s"
