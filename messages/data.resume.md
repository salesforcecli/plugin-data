# summary

View the status of a bulk data load job or batch.

# description

Run this command using the job ID or batch ID returned from the "<%= config.bin %> data delete bulk" or "<%= config.bin %> data upsert bulk" commands.

# examples

- View the status of a bulk load job:

  <%= config.bin %> <%= command.id %> --job-id 750xx000000005sAAA

- View the status of a bulk load job and a specific batches:

  <%= config.bin %> <%= command.id %> --job-id 750xx000000005sAAA --batch-id 751xx000000005nAAA

# flags.job-id.summary

ID of the job whose status you want to view.

# flags.batch-id.summary

ID of the batch whose status you want to view; you must also specify the job ID.

# NoBatchFound

Unable to find batch %s for job %s.
