# summary

Get the results of a Bulk API 2.0 ingest job.

# description

You can use this command to get successful/failed/unprocessed results of a bulk 2.0 ingest job written to different files in comma-separated values (CSV) format.

If the job was aborted/failed you might also get unprocessed results.

# flags.job-id.summary

Job ID of the bulk job.

# examples

- Get results from a bulk import job. Use the org with alias "my-scratch"

  <%= config.bin %> <%= command.id %> --job-id 7507i000008341G --target-org my-scratch

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
