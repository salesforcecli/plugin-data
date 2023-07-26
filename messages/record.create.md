# summary

Create and insert a record into a Salesforce or Tooling API object.

# description

You must specify a value for all required fields of the object.

When specifying fields, use the format <fieldName>=<value>. Enclose all field-value pairs in one set of double quotation marks, delimited by spaces. Enclose values that contain spaces in single quotes.

This command inserts a record into Salesforce objects by default. Use the --use-tooling-api flag to insert into a Tooling API object.

# flags.sobject.summary

API name of the Salesforce or Tooling API object that you're inserting a record into.

# flags.values.summary

Values for the flags in the form <fieldName>=<value>, separate multiple pairs with spaces.

# flags.use-tooling-api.summary

Use Tooling API so you can insert a record in a Tooling API object.

# examples

- Insert a record into the Account object of your default org; only the required Name field has a value:

  <%= config.bin %> <%= command.id %> --sobject Account --values "Name=Acme"

- Insert an Account record with values for two fields, one value contains a space; the command uses the org with alias "my-scratch":

  <%= config.bin %> <%= command.id %> --sobject Account --values "Name='Universal Containers' Website=www.example.com" --target-org my-scratch

- Insert a record into the Tooling API object TraceFlag:

  <%= config.bin %> <%= command.id %> --use-tooling-api --sobject TraceFlag --values "DebugLevelId=7dl170000008U36AAE StartDate=2022-12-15T00:26:04.000+0000 ExpirationDate=2022-12-15T00:56:04.000+0000 LogType=CLASS_TRACING TracedEntityId=01p17000000R6bLAAS"

# createSuccess

Successfully created record: %s.

# createFailure

Failed to create record. %s
