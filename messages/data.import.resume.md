# summary

Resume a bulk import job that you previously started. Uses Bulk API 2.0.

# description

When the original "sf data import bulk" command either times out or is run with the --async flag, it displays a job ID. To see the status and get the results of the bulk import, run this command by either passing it the job ID or using the --use-most-recent flag to specify the most recent bulk import job.

# examples

- Resume a bulk import job to your default org using an ID:

  <%= config.bin %> <%= command.id %> --job-id 750xx000000005sAAA

- Resume the most recently run bulk import job for an org with alias my-scratch:

  <%= config.bin %> <%= command.id %> --use-most-recent --target-org my-scratch

# flags.use-most-recent.summary

Use the job ID of the bulk import job that was most recently run.

# flags.job-id.summary

Job ID of the bulk import.

# flags.wait.summary

Time to wait for the command to finish, in minutes.
