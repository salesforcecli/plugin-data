# summary

View the status of a bulk query.

# description

Run this command using the job ID returned from the "<%= config.bin %> data query --bulk" command.

# examples

- View the status of a bulk query with the specified ID:

  <%= config.bin %> <%= command.id %> --bulk-query-id 7500x000005BdFzXXX

# flags.bulkQueryId.summary

Job ID of the bulk query.

# flags.useMostRecent.summary

Use the most recent bulk query ID from cache.
