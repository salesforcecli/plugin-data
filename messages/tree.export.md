# summary

export data from an org

# description

export data from an org
Exports data from an org into sObject tree format for use with the force:data:tree:import command.
The query for export can return a maximum of 2,000 records. For more information, see the REST API Developer Guide: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobject_tree.htm

# flags.query

soql query, or filepath of file containing a soql query, to retrieve records

# flags.plan

generate mulitple sobject tree files and a plan definition file for aggregated import

# flags.prefix

prefix of generated files

# flags.outputdir

directory to store files

# examples

- $ sfdx force:data:tree:export -q "SELECT Id, Name, (SELECT Name Address**c FROM Properties**r) FROM Broker\_\_c"

- $ sfdx force:data:tree:export -q <path to file containing soql query> -x export-demo -d /tmp/sfdx-out -p
