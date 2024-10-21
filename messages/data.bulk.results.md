# summary

Summary of a command.

# description

More information about a command. Don't repeat the summary.

# flags.job-id.summary

Job ID of the bulk job.

# examples

- <%= config.bin %> <%= command.id %>

# error.jobInProgress

Job hasn't finished being processed yet.

# error.invalidId

Can't find a bulk job with ID %s.

# error.invalidId.actions

- Ensure the ID isn't from a query job.

- Check the job for the ID shows up in the org:

sf org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F750"

# error.noRecords

Unable to get results because the job processed 0 records.
