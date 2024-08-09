# summary

Execute a SOSL text-based search query.

# description

Specify the SOSL query at the command line with the --query flag or read the query from a file with the --file flag.

# examples

- Specify a SOSL query at the command line; the command uses your default org:

  <%= config.bin %> <%= command.id %> --query "FIND {Anna Jones} IN Name Fields RETURNING Contact (Name, Phone)"

- Read the SOSL query from a file called "query.txt"; the command uses the org with alias "my-scratch":

  <%= config.bin %> <%= command.id %> --file query.txt --target-org my-scratch

- Similar to previous example, but display the results as comma-separated values:

  <%= config.bin %> <%= command.id %> --file query.txt --target-org my-scratch --result-format csv

# flags.query.summary

SOSL query to execute.

# flags.result-format.summary

abs

# flags.file.summary

File that contains the SOSL query.

# displayQueryRecordsRetrieved

Total number of records retrieved: %s.

# queryRunningMessage

Querying Data
