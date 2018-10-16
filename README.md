wikibase2triplestore checks all the recent changes inside a Wikibase instance
and for each item modified it writes on a triplestore the correspondent RDF.

With default parameters the tool starts to listen to your wikibase instance with
the current date and checks for changes every 10 seconds, forever.

## Install
```
npm install
```

## Usage
```
node wikibase2triplestore.js
```

### Parameters
In bold the mandatory.

| parameter               | type    | description             |
| ----------------------- | ------- | ----------------------- |
| **`sparql`**            | url     | SPARQL endpoint URL     |
| **`wikibase`**          | url     | Wikibase URL            |
| `wikibaseApi`           | string  | Wikibase API path       |
| `wikibaseSpecialEntity` | string  | Special:EntityData path |
| `date`                  | date    | Start date of changes   |

If you don't set any `date` it will use the current timestamp.

### Example

```
node wikibase2triplestore.js --sparql http://atlas.synapta.io:9999/blazegraph/namespace/leibnitiana/sparql --wikibase https://data.leibnitiana.eu --date 20170726000000
```
