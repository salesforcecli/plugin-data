# summary

Summary of a command.

# description

More information about a command. Don't repeat the summary.

# flags.name.summary

Description of a flag.

# flags.name.description

More information about a flag. Don't repeat the summary.

# examples

- <%= config.bin %> <%= command.id %>

# flags.async.summary

Don't wait for the command to complete.

# flags.wait.summary

Time to wait for the command to finish, in minutes.

# flags.file.summary

CSV file that contains the Salesforce object records you want to update.

# flags.sobject.summary

API name of the Salesforce object, either standard or custom, which you are updating.

# flags.line-ending.summary

Line ending used in the CSV file. Default value on Windows is `CRLF`; on macOS and Linux it's `LF`.

# export.resume

Run "sf data import resume --job-id %s" to resume the operation.

# error.timeout

The operation timed out after %s minutes.

Run "sf data import resume --job-id %s" to resume it.

# error.failedRecordDetails

Job finished being processed but failed to update %s records.

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
