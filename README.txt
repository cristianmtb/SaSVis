This text file describes the file structure of the project.

/doc - documentation and scripts used for project development (must NOT be deployed to a running instance of the project!) 
/doc/parse_csv_data.py - script for parsing the CSV data exported from Google Docs spreadsheet with papers description (used initially; otherwise, simply start working on the JSON files below and ignore this script and the one below)
/doc/merge_json_data.py - script for merging the JSON data files (used initially)
/doc/sync.sh - script for merging the updated local data with a remotely deployed version (if necessary)

/data/categories.json – hierarchical list of category names and corresponding icons
/data/content.json – list of entries; ID fields are used to index corresponding files in thumbs and bibtex directories

/css - CSS style sheets
/fonts - glyph fonts required by Bootstrap
/images - various icons used by UI (including SVG source files)

/js - JavaScript files
/js/biovisexplorer.js - the main script
/js/{html5shiv.js,respond.min.js} - scripts required by Bootstrap

/index.html - the main HTML file

/webserver.py - simple development web server, if any needed

P.S.: the project used to be called "BioVis Wizard" internally until the title was changed to "BioVis Explorer", 
so the old title may appear somewhere. 
 