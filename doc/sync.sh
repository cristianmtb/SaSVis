#!/bin/bash

SRC=~/Coding/projects/eclipse-workspace-isovis/bioviswizard
DEST=/Volumes/www/biovis

if [[ ! -d $DEST ]]; then
	echo "Error: the destination directory is unavailable"
	exit 1
fi
	

rsync -ah $SRC/{bibtex,css,js,images,thumbs,index.html} $DEST/
rsync -ah $SRC/data/categories.json $DEST/data/

comp=$(diff --unchanged-line-format= --old-line-format= --new-line-format='%L' $SRC/data/content.json $DEST/data/content.json) trimmed=$(echo -n $comp)

if [[ -n $trimmed ]]; then
	echo "Content modified on server: $comp";
else
	rsync -ah $SRC/data/content.json $DEST/data/
fi