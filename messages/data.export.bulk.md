# summary

Bulk export records from an org into a file using a SOQL query. Uses Bulk API 2.0.

# description

You can use this command to export millions of records from an org, either to migrate data or to back it up.

Use a SOQL query to specify the fields of a standard or custom object that you want to export. Specify the SOQL query either at the command line with the --query flag or read it from a file with the --query-file flag; you can't specify both flags. The --output-file flag is required, which means you can only write the records to a file, in either CSV or JSON format. 

Bulk exports can take a while, depending on how many records are returned by the SOQL query. If the command times out, or you specified the --async flag, the command displays the job ID. To see the status and get the results of the job, run "sf data export resume" and pass the job ID to the --job-id flag.

IMPORTANT: This command uses Bulk API 2.0, which limits the type of SOQL queries you can run. For example, you can't use aggregate functions such as count(). For the complete list of limitations, see the "SOQL Considerations" section in the "Bulk API 2.0 and Bulk API Developer Guide" (https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/queries.htm).

# examples

- Export the Id, Name, and Account.Name fields of the Contact object into a CSV-formatted file; if the export doesn't complete in 10 minutes, the command ends and displays a job ID. Use the org with alias "my-scratch":

  <%= config.bin %> <%= command.id %> --query "SELECT Id, Name, Account.Name FROM Contact" --output-file export-accounts.csv --wait 10 --target-org my-scratch

- Similar to previous example, but use the default org, export the records into a JSON-formatted file, and include records that have been soft deleted:

  <%= config.bin %> <%= command.id %> --query "SELECT Id, Name, Account.Name FROM Contact" --output-file export-accounts.json --result-format json --wait 10 --all-rows

- Export asynchronously; the command immediately returns a job ID that you then pass to the "sf data export resume" command:

  <%= config.bin %> <%= command.id %> --query "SELECT Id, Name, Account.Name FROM Contact" --output-file export-accounts.json --result-format json --async

# flags.wait.summary

Time to wait for the command to finish, in minutes.

# flags.async.summary

Don't wait for the job to complete.

# flags.query.summary

SOQL query to execute.

# flags.all-rows.summary

Include records that have been soft-deleted due to a merge or delete. By default, deleted records are not returned.

# flags.output-file.summary

File where records are written.

# flags.result-format.summary

Format to write the results.

# flags.column-delimiter.summary

Column delimiter to be used when writing CSV output. Default is COMMA.

# flags.line-ending.summary

Line ending to be used when writing CSV output. Default value on Windows is is `CRLF`; on macOS and Linux it's `LR`.

# flags.query-file.summary

File that contains the SOQL query.

# export.timeout

Run "sf data export resume --job-id %s" to get the latest status and results.
