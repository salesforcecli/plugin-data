# summary

Export data using the Bulk API V2. Read more clicking on this [link](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/queries.htm).

# description

This command enables Users to export a large amount of data from Salesforce and save to disk as CSV or JSON files.

# examples

- Export data as JSON

  <%= config.bin %> <%= command.id %> --query "SELECT Id, Name, Account.Name FROM Contact"

- Export data using a SOQL query defined in a file called "query.txt"

  <%= config.bin %> <%= command.id %> --file query.txt

- Export data as CSV

  <%= config.bin %> <%= command.id %> --query "SELECT Id, Name, Account.Name FROM Contact" --output-format csv

- Export data asynchronously

  <%= config.bin %> <%= command.id %> --query "SELECT Id FROM Contact" --wait 0

# flags.queryToExecute

SOQL query to execute.

# flags.file

File that contains the SOQL query.

# flags.wait

Time to wait for the command to finish, in minutes.

# flags.targetOrg.summary

Org alias or username to use for the target org.

# flags.outputDirectory

Output directory where the file is going to be created. This folder must exist already, otherwise an exception is raised. If omitted, it defaults to the root of the current working directory.

# flags.fileName

File name without the file extension.

# flags.outputFormat

File output format: csv or json. It defaults to json.

# queryRunningMessage

Querying Data

# queryTimeout

Query ID: %s
Query is in progress.

Run "data export bulk resume -i %s -o %s --output-directory %s --file-name %s" to continue the data exporting process.
