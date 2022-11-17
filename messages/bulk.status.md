# summary

view the status of a bulk data load job or batch

# description

view the status of a bulk data load job or batch
Run this command using the job ID or batch ID returned from the data:delete:bulk or data:upsert:bulk commands.

# examples

- <%= config.bin %> <%= command.id %> -i 750xx000000005sAAA

- <%= config.bin %> <%= command.id %> -i 750xx000000005sAAA -b 751xx000000005nAAA

# flags.jobid

the ID of the job you want to view or of the job whose batch you want to view

# flags.batchid

the ID of the batch whose status you want to view

# NoBatchFound

Unable to find batch %s for job %s.
