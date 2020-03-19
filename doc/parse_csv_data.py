#!/usr/bin/env python
# Note: this script requires Python 2.7+ to run

# The script parses CSV data exported from the Google Docs spreadsheet and creates a JSON file
# Usage: python parse_csv_data.py csv_input.csv json_output.json
# Note: the script makes assumptions about order and contents of rows and columns in the CSV file,
# so modify it if necessary

import csv
import sys
import re
import json
from collections import OrderedDict
import copy

# Number of header rows to skip at the top of file
NUM_HEADER_ROWS = 3  

# Number of columns to skip when testing the rows
NUM_COL_SKIP = 1

# Boilerplate dictionaries
# OrderedDict are used instead of regular dicts to ensure key order in items
PROTOTYPE = OrderedDict([
    ('id', ""),
    ('title', ""),
    ('year', 0),
        
    ('authors', ""),
    ('reference', ""),
    ('url', ""),
    
    ('categories', None),
    
    ('first_author', ""),
    ('evidence', ""),
    ('venue', ""),
    
    ('latest_update', ""),
    ('citations_google_scholar', ""),
    ('citations_microsoft_academic_search', ""),
    ('citations_web_of_science', ""),
    
    ('pmid', ""),
    ('implementation_url', "")
])

# Dictionary of main item keys
INDEX_ATTRIBUTES = {
    1: 'first_author',
    2: 'title',
    3: 'year',
    4: 'evidence',
    5: 'venue',
    
    26: 'latest_update',
    27: 'citations_google_scholar',
    28: 'citations_microsoft_academic_search',
    29: 'citations_web_of_science',
    
    30: 'pmid',
    31: 'implementation_url' 
}

# Dictionary of category keys
INDEX_CATEGORIES = {
    6: 'tables',
    7: 'networks',
    8: 'hierarchies',
    9: 'sequences',
    
    10: 'temporal',
    11: 'ordinal',
    12: 'spatial',
    13: 'nominal',
    14: 'quantitative',
    15: 'uncertainty',
    
    16: 'explore',
    17: 'search',
    18: 'filter',
    19: 'select',
    20: 'compare',
    21: 'cluster',
    22: 'annotate',
    23: 'share',
    24: 'guide'
}

# Loads the CSV data
def load_data(filename):
    result = []

    with open(filename, 'rb') as f:
        reader = csv.reader(f)
        result = [x for x in reader]
    
    return result

# Checks whether the row is empty
def is_nonempty_row(row):
    return False if not row else any(row[NUM_COL_SKIP:])

# Preprocesses the rows array
def preprocess_rows(rows):
    return filter(is_nonempty_row, rows[NUM_HEADER_ROWS:])

# Processes the rows to create a list of dictionary objects
def process_rows(rows):
    used_ids = {}
    return [process_row(x, used_ids) for x in rows]
    
# Generates a dictionary object based on a provided row    
def process_row(row, used_ids):
    result = copy.deepcopy(PROTOTYPE)
    result['categories'] = []
    
    # Copy the main attributes from the row
    for i, key in INDEX_ATTRIBUTES.iteritems():
        if i >= len(row):
            continue
            
        if row[i].strip():
            result[key] = row[i].strip()
    
    # Copy the categories from the row
    for i, key in INDEX_CATEGORIES.iteritems():
        if i >= len(row):
            continue
        
        val = row[i].strip()
        
        if val == "X" or val == "(X)":
            result['categories'].append(key)
        
    # Take care of several specific attributes
    result['year'] = int(result['year'])

    temp_id = re.sub("\W", "", result['first_author']) + str(result['year'])
    if temp_id not in used_ids:
        result['id'] = temp_id
        used_ids[temp_id] = True
    else:
        # Come up with a modified id
        i = 1
        while (temp_id + "_" + str(i)) in used_ids:
            i += 1
        
        result['id'] = temp_id + "_" + str(i)
        used_ids[temp_id + "_" + str(i)] = True

    return result
    
def main():
    if len(sys.argv) < 2:
    	print "Error: missing input filename\n"
    	sys.exit(1)
        
    rows = preprocess_rows(load_data(sys.argv[1]))
    dicts = process_rows(rows)
    
    if len(sys.argv) < 3:
        print json.dumps(dicts, indent=4)
    else:
        with open(sys.argv[2], 'wb') as f:
            json.dump(dicts, f, indent=4)
    

if __name__ == "__main__":
    main()