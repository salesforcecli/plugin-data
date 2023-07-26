# summary

View the status of a bulk data load job or batch. Uses Bulk API 1.0.

# description

Run this command using the job ID or batch ID returned from the "<%= config.bin %> force data bulk delete" or "<%= config.bin %> force data bulk upsert" commands.

# examples

- View the status of a bulk load job in your default org:

  <%= config.bin %> <%= command.id %> --job-id 750xx000000005sAAA

- View the status of a bulk load job and a specific batches in an org with alias my-scratch:

  <%= config.bin %> <%= command.id %> --job-id 750xx000000005sAAA --batch-id 751xx000000005nAAA --target-org my-scratch

# flags.job-id.summary

ID of the job whose status you want to view.

# flags.batch-id.summary

ID of the batch whose status you want to view; you must also specify the job ID.

# NoBatchFound

Unable to find batch %s for job %s.
