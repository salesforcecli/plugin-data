# dataFileEmpty

Data file is empty: %s.

# dataImportFailed

Import failed from file: %s. Results: %s.

# FlsError

We couldn't process your request because you don't have access to %s on %s. To learn more about field-level security, visit Tips and Hints for Page Layouts and Field-Level Security in our Developer Documentation.

# error.InvalidDataImport

Data plan file %s did not validate against the schema. Errors: %s.

# error.InvalidDataImport.actions

- Did you run the "sf data export tree" command with the --plan flag?

- Make sure you're importing a plan definition file.

- Get help with the import plan schema by running "sf data import tree --help".

# error.NonStringFiles

The `files` property of the plan objects must contain only strings

# error.UnresolvableRefs

There are references in a data file %s that can't be resolved:

%s

# error.RefsInFiles

The file %s includes references (ex: '@AccountRef1'). Those are only supported with --plan, not --files.`

# error.noRecordTypeName

This file contains an unresolvable RecordType ID. Try exporting the data by specifying RecordType.Name in the SOQL query, and then run the data import again.
