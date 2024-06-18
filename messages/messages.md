# success

Bulk %s request %s started successfully.

# checkStatus

Run the command "sf data %s resume -i %s -o %s" to check the status.

# checkJobViaUi

To review the details of this job, run:
sf org open --target-org %s --path "/lightning/setup/AsyncApiJobStatus/page?address=%2F%s"

# remainingTimeStatus

Remaining time: %d minutes.

# remainingRecordsStatus

Processed %d | Success %d | Fail %d

# bulkJobFailed

The bulk job %s failed. Check the job status for more information.

# perfLogLevelOption

Get API performance data.

# perfLogLevelOptionLong

Gets data on API performance metrics from the server. The data is stored in $HOME/.sfdx/apiPerformanceLog.json.

# DataRecordGetNoRecord

No matching record found.

# DataRecordGetMultipleRecords

%s is not a unique qualifier for %s; %s records were retrieved.
Retrieve only one record by making your --where clause more specific.

# TextUtilMalformedKeyValuePair

Malformed key=value pair for value: %s.

# flags.resultFormat.summary

Format to display the results; the --json flag overrides this flag.

# bulkRequestIdRequiredWhenNotUsingMostRecent

The bulk request id must be supplied when not looking for most recent cache entry.

# cannotFindMostRecentCacheEntry

Could not load a most recent cache entry for a bulk request. Please rerun your command with a bulk request id.

# cannotCreateResumeOptionsWithoutAnOrg

Cannot create a cache entry without a valid org.

# usernameRequired

A valid username is required when creating a cache entry.

# invalidSobject

The supplied SObject type "%s" is invalid. Error message: %s.
