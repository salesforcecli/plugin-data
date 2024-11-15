# export.resume

Run "sf %s --job-id %s" to resume the operation.

# error.timeout

The operation timed out after %s minutes.

Run "sf %s --job-id %s" to resume it.

# error.failedRecordDetails

Job finished being processed but failed to process %s records.

# error.failedRecordDetails.actions

- Get the job results by running: "sf data bulk results -o %s --job-id %s".
- View the job in the org: "sf org open -o %s --path '/lightning/setup/AsyncApiJobStatus/page?address=%2F%s'".

# error.jobFailed

Job failed to be processed due to:

%s

# error.jobFailed.actions

- Get the job results by running: "sf data bulk results -o %s --job-id %s".
- View the job in the org: "sf org open -o %s --path '/lightning/setup/AsyncApiJobStatus/page?address=%2F%s'".

# error.jobAborted

Job has been aborted.

# error.jobAborted.actions

- Get the job results by running: "sf data bulk results -o %s --job-id %s".
- View the job in the org: "sf org open -o %s --path '/lightning/setup/AsyncApiJobStatus/page?address=%2F%s'".

# error.hardDeletePermission

You must have the "Bulk API Hard Delete" system permission to use the --hard-delete flag. This permission is disabled by default and can be enabled only by a system administrator.

# flags.column-delimiter.summary

Column delimiter used in the CSV file.

# flags.line-ending.summary

Line ending used in the CSV file. Default value on Windows is `CRLF`; on macOS and Linux it's `LF`.

# flags.sobject.summary

API name of the Salesforce object, either standard or custom, that you want to update or delete records from.

# flags.csvfile.summary

CSV file that contains the IDs of the records to update or delete.

# flags.wait.summary

Number of minutes to wait for the command to complete before displaying the results.

# flags.async.summary

Run the command asynchronously.

# flags.verbose.summary

Print verbose output of failed records if result is available.

# flags.jobid

ID of the job you want to resume.

# flags.useMostRecent.summary

Use the ID of the most recently-run bulk job.

# flags.targetOrg.summary

Username or alias of the target org. Not required if the "target-org" configuration variable is already set.

# flags.wait.summary

Number of minutes to wait for the command to complete before displaying the results.
