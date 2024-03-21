# dataFileNotProvided

Provide a data plan or file(s).

# dataFileNotFound

Can't find data file. Indicate a valid path: %s.

# unknownContentType

Unable to determine content type for file: %s.

# dataFileUnsupported

Content type: %s not supported.

# dataFileEmpty

Data file is empty: %s.

# dataFileInvalidJson

Data file is invalid JSON: %s

# dataFileNoRefId

Found references in file, but no reference-id content found (%s). Were parent SObjects saved first?

# tooManyFiles

Specify either sObject tree files or a plan definition file, but not both.

# dataImportFailed

Import failed from file: %s. Results: %s.

# dataPlanValidationError

Data plan file %s did not validate against the schema. Errors: %s.

# dataPlanValidationErrorActions

- Did you run the "sf data export tree" command with the --plan flag?

- Make sure you're importing a plan definition file.

- Get help with the import plan schema by running "sf data import tree --config-help".

# FlsError

We couldn't process your request because you don't have access to %s on %s. To learn more about field-level security, visit Tips and Hints for Page Layouts and Field-Level Security in our Developer Documentation.

# error.InvalidDataImport

Data plan file %s did not validate against the schema. Errors: %s.

# error.InvalidDataImport.actions

- Did you run the "sf data export tree" command with the --plan flag?

- Make sure you're importing a plan definition file.

- Get help with the import plan schema by running "sf data import beta tree --help".

# saveResolveRefsIgnored

The plan contains the 'saveRefs' and/or 'resolveRefs' properties.
These properties will be ignored and can be removed.
In the future, the `tree export` command will not produce them.

# error.NonStringFiles

The `files` property of the plan objects must contain only strings

# error.UnresolvableRefs

There are references in a data file %s that can't be resolved:

%s

# error.RefsInFiles

The file %s includes references (ex: '@AccountRef1'). Those are only supported with --plan, not --files.`
