# summary

Resume a bulk update job that you previously started. Uses Bulk API 2.0.

# description

When the original "sf data update bulk" command times out, it displays a job ID. To see the status and get the results of the bulk update, run this command by either passing it the job ID or using the --use-most-recent flag to specify the most recent bulk update job.

Using either `--job-id` or `--use-most-recent` will properly resolve to the correct org where the bulk job was started based on the cached data by "data update bulk".

# examples

- Resume a bulk update job using a job ID:

  <%= config.bin %> <%= command.id %> --job-id 750xx000000005sAAA

- Resume the most recently run bulk update job:

  <%= config.bin %> <%= command.id %> --use-most-recent

# flags.use-most-recent.summary

Use the job ID of the bulk update job that was most recently run.

# flags.job-id.summary

Job ID of the bulk update.

# flags.wait.summary

Time to wait for the command to finish, in minutes.
