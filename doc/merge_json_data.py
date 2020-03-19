#!/usr/bin/env python
# Note: this script requires Python 2.7+ to run

# The script merges the main JSON data file with new data entries/fields from a second JSON file, and saves the results into a new file
# Usage: python merge_json_data.py main_data.json new_data.json output.json

import sys
import json
from collections import OrderedDict


# Loads the JSON data files
def load_files(main_data_filename, new_data_filename):
    main_data = None
    new_data = None
    
    with open(main_data_filename, 'rb') as f:
        main_data = json.load(f, object_pairs_hook=OrderedDict)
        
    with open(new_data_filename, 'rb') as f:
        new_data = json.load(f, object_pairs_hook=OrderedDict)
        
    return (main_data, new_data)    


# Creates an index of data array entries based on the "id" field
def get_index(data):
    return dict(zip(map(lambda entry: entry['id'], data),
                    data))


# Injects additional fields into detected entries in main data,
# and copies the new entries
def merge_data(main_data, new_data):
    # First, create an index of unseen new entries
    unseen_index = get_index(new_data)

    # Iterate over entries of the main data array
    for entry in main_data:
        # Check if an unseen new entry with the same ID exists
        if entry['id'] in unseen_index:
            # Iterate over fields of the unseen entry
            for k, v in unseen_index[entry['id']].iteritems():
                # Copy if necessary
                if k not in entry:
                    entry[k] = v 
                    
            # Remove from index
            del unseen_index[entry['id']]
            
    
    # Iterate over entries of the new data array         
    for entry in new_data:
        # Check if the entry has been processed already
        if entry['id'] in unseen_index:
            # Copy entry to the main array
            main_data.append(entry)
            
            # Remove from index
            del unseen_index[entry['id']]
        
    
    return main_data


def main():
    if len(sys.argv) < 4:
        print "Error: missing filename(s)\n"
        sys.exit(1)
        
    main_data_filename = sys.argv[1]
    new_data_filename = sys.argv[2]
    output_filename = sys.argv[3]
    
    (main_data, new_data) = load_files(main_data_filename, new_data_filename)
    
    output_data = merge_data(main_data, new_data)
        
    with open(output_filename, 'wb') as f:
        json.dump(output_data, f, indent=4)
    

if __name__ == "__main__":
    main()