# summary

Execute a SOSL text-based search query.

# description

Specify the SOSL query at the command line with the --query flag or read the query from a file with the --file flag.

By default, the results are written to the terminal in human-readable format. If you specify `--result-format csv`, the output is written to one or more CSV (comma-separated values) files. The file names correspond to the Salesforce objects in the results, such as Account.csv. Both `--result-format human` and `--result-format json` display only to the terminal.

# examples

- Specify a SOSL query at the command line; the command uses your default org:

  <%= config.bin %> <%= command.id %> --query "FIND {Anna Jones} IN Name Fields RETURNING Contact (Name, Phone)"

- Read the SOSL query from a file called "query.txt"; the command uses the org with alias "my-scratch":

  <%= config.bin %> <%= command.id %> --file query.txt --target-org my-scratch

- Similar to the previous example, but write the results to one or more CSV files, depending on the Salesforce objects in the results:

  <%= config.bin %> <%= command.id %> --file query.txt --target-org my-scratch --result-format csv

# flags.query.summary

SOSL query to execute.

# flags.result-format.summary

Format to display the results, or to write to disk if you specify "csv".

# flags.file.summary

File that contains the SOSL query.

# displayQueryRecordsRetrieved

Total number of records retrieved: %s.

# queryRunningMessage

Querying Data
