"use strict";

// Default thumbnail image
var defaultThumb = new Image();
defaultThumb.src = "images/no-image.svg";

// The threshold between adjacent year entries to introduce a gap in the time chart
var YEAR_GAP_THRESHOLD = 5; 

// Array of categories data as hierarchical structure
var categories = [];
// Map of categories indexed by title
var categoriesMap = {};
// Category indices (used for output sorting purposes)
var categoriesIndices = {};

// List of categories that do not cover the whole entries set
var incompleteCategories = [];

// Map of entries indexed by IDs
var entriesMap = {};

// Categories statistics
var stats = {};
// Statistics entries map (used for indexing)
var statsMap = {};

// Search field value
var searchText = "";

// Time filter entries
var timeFilterEntries = [];

// Glyph size used for layout
var GLYPH_SIZE = 32;
var GLYPH_THUMBNAIL_SIZE = 28;

// Glyph padding (margin) used for layout
var GLYPH_PADDING = 10;

// Current window size (used to ignore redundant resize events)
var windowWidth;
var windowHeight;

// Default layout size
var LAYOUT_WIDTH = 1200;
var LAYOUT_HEIGHT = 900;

// Layout nodes
var layoutNodes;
// Layout node distances (resulting values calculated by weighted sum)
var layoutNodeDistances;
// Layout node distances (separate factors of distance)
var layoutNodeSourceDistances;

// Range of year values for entries
var yearRange;
// Weights for the distance computations
var distanceWeights = {year: 1.0, dataTypes: 1.0, dataProperties: 1.0, tasks: 1.0, authors: 1.0};
// Weight normalization value
var distanceWeightNorm = 5.0;

// The filter mode flag for entries with large distance values 
var FILTER_DISSIMILAR = true;
var SIMILARITY_THRESHOLD = 0.5;

// Zoom handler used for visualization
var zoomHandler;
// Default pan & zoom values
var DEFAULT_ZOOM = 0.95;
var DEFAULT_PAN = [GLYPH_SIZE / 2, GLYPH_SIZE / 2];

// Scales and domains used for visualization
var xScale;
var yScale;

var xDomain;
var yDomain;

// References to the time chart-related objects
var timeChartSvg;
var timeChartXScale;
var timeChartYScale;
var timeChartHeight;
var timeChartData;

$(document).ready(function(){
	windowWidth = $(window).width();
	windowHeight = $(window).height();
	
	setupTooltips();
    loadCategories();
    setupHandlers();
    setupWeightSliders();
});

// Handles window resize
$(window).resize(function() {
    if(this.resizeTO) clearTimeout(this.resizeTO);
    this.resizeTO = setTimeout(function() {
        $(this).trigger('resizeEnd');
    }, 500);
});

$(window).bind('resizeEnd', function(){
	// Check if the resize really occurred
	var newWidth = $(window).width();
	var newHeight = $(window).height();
	
	if (newWidth != windowWidth
		|| newHeight != windowHeight) {
		windowWidth = newWidth;
		windowHeight = newHeight;
	} else {
		// Abort the handler
		return;
	}
		
	// Reset the current visualization to make sure
	// container size is reset
	resetVisualization();
	
	// Update the layout size
	updateLayoutSize();
		
	// Update the layout and visualization
	calculateLayout();
	renderVisualization();
});

// Updates the layout size
function updateLayoutSize() {
	// Width must take padding values for the container and its wrapper into account
	var entriesContainer = $("#entriesContainer");
	
	LAYOUT_WIDTH = $(window).width() - $(".sidebar-fixed").width()
		- parseInt(entriesContainer.css("padding-left")) * 2
		- parseInt(entriesContainer.css("padding-right")) * 2;
	
	LAYOUT_HEIGHT = $(window).height() - $(".navbar.custom-navbar").height()
		- parseInt($(".navbar.custom-navbar").css("margin-bottom")) * 2;
	
//	if (LAYOUT_HEIGHT > parseInt(entriesContainer.css("max-height")))
//		LAYOUT_HEIGHT = parseInt(entriesContainer.css("max-height"));	
	
	var maxEntriesContainerHeight = $(window).height() - $(".navbar.custom-navbar").height()
		- parseInt($(".navbar.custom-navbar").css("margin-bottom")) * 2;

	if (maxEntriesContainerHeight < parseInt(entriesContainer.css("min-height")))
		maxEntriesContainerHeight = parseInt(entriesContainer.css("min-height"));
	
	// Update the height of the categories list
	var categoriesListContainer = $("#categoriesList");
	
	// Get the total height of the side panel when the main filters tab is displayed
	// The tab must be displayed at this time, otherwise jQuery will report height of 0px
	var currentTabLink = $("#filtersTabList > .active > a").first();
	$("#filtersTabList a[href=#mainFilters]").first().tab("show");
	
	var categoriesListScrollHeight = categoriesListContainer[0].scrollHeight;
	
	var filterPanelTopHeight = $("#filtersTabList").outerHeight();
	$("#mainFilters > *:not(#categoriesList)").each(function(){
		filterPanelTopHeight += $(this).outerHeight();
	});
			
	// Switch back to the corresponding tab
	currentTabLink.tab("show");
	
	// Set a reasonable fallback value
	var maxCategoriesListContainerHeight = Math.max(maxEntriesContainerHeight - filterPanelTopHeight, parseInt(entriesContainer.css("min-height")));
		
	categoriesListContainer.height(Math.min(categoriesListScrollHeight, maxCategoriesListContainerHeight));
}

// Sets up the UI tooltips 
function setupTooltips(){
	$("body").tooltip({
        selector: "#visSvg .content-entry, #timeChartSvg g.time-chart-entry.not-gap",
        container: "body",
        placement: "auto"
    });
	
	// Hide the tooltips after a certain delay
	// Timeouts must be handled for corresponding elements to provide a consistent behavior
	$("body").on("shown.bs.tooltip", "#visSvg .content-entry", function(){
		var entry = $(this);
		
		if (entry.data("tooltipTimeout") != null) {
			clearTimeout(entry.data("tooltipTimeout"));
		}
		
	    var timeout = setTimeout(function() {
	        //$(".tooltip").fadeOut();
	    	entry.removeData("tooltipTimeout");
	    	entry.tooltip("hide");
	    }, 2000);
	    
	    entry.data("tooltipTimeout", timeout);
	});
}

// Sets up the general UI handlers
function setupHandlers(){
	$(".search-clear").on("click", onSearchClear);
	$("#searchField").on("keyup", onSearch);
	
	$("#categoriesList")
		.on("click", ".category-entry", onFilterToggle)
		.on("click", ".reset-category-filter", onCategoryFilterReset);
	
	$("#entriesContainer")
		.on("click", "#resetPanZoom", onCenterButtonClick)
		.on("click", ".content-entry", onEntryClick)
		.on("contextmenu", ".content-entry", onEntryRightClick)
		.on("mouseover", ".content-entry", onEntryHoverOn)
		.on("mouseout", ".content-entry", onEntryHoverOff);
	
	$("#entryDetailsModal").on("hidden.bs.modal", onDetailsModalHidden);
	
	$("#addEntryModal").on("keypress", function(e) {
		if (e.which == 13)
			$("#processNewEntry").click();
	});
	
	$("#addEntryModal form").on("reset", onAddFormReset);

	$("#processNewEntry").on("click", onAddEntry);
		
	$("#aboutModal").on("shown.bs.modal", onAboutModalShown);
		
	$("#similarEntries").on("click", ".similar-entry-link", onSimilarEntryLinkClick);
	
	$("#resetWeights").on("click", onResetWeights);
}

// Handles a search query change
function onSearch(){
	searchText = $("#searchField").val();
	updateDisplayedEntries();
}

// Handles a search query reset
function onSearchClear(){
	$("#searchField").val("");
	$("#searchField").trigger("keyup");
}

// Handles a category filter toggle
function onFilterToggle(){
	var element = $(this);
	
	if (!element.hasClass("active"))
		element.addClass("active");
	else
		element.removeClass("active");
	
	updateCategoryResetButton(element);
	updateDisplayedEntries();
}

// Updates a filter reset button for a category
function updateCategoryResetButton(element){
	var container = element.parent();
	var resetButton = container.parent().find(".reset-category-filter");
	
	if (container.children(".category-entry:not(.active)").length > 0)
		resetButton.removeClass("hidden");
	else
		resetButton.addClass("hidden");
}

// Reset the filters for a category
function onCategoryFilterReset(){
	var element = $(this);
	
	element.parent().next(".category-entries-container").children(".category-entry").addClass("active");
	element.addClass("hidden");
	
	updateDisplayedEntries();
}

// Displays the selected entry details
function onEntryClick(){
	var id = $(this).data("id");
	
	if (!entriesMap[id])
		return;
	
	$(this).tooltip("hide");
	
	//$(this).addClass("active");
	d3.select(this)
		.classed("active", true);
	
	displayEntryDetails(id);
}

// Displays the details dialog for the provided entry ID
// Can be invoked from the summary table handler, for instance
function displayEntryDetails(id) {
	if (!entriesMap[id])
		return;
	
	var entry = entriesMap[id];
	
	$("#entryDetailsThumbnail").attr("src", entry.thumb ? entry.thumb.src : defaultThumb.src);
	
	$("#entryDetailsModal .entry-details-field").empty();
	
	$("#entryDetailsTitle").html(entry.title + " (" + entry.year + ")");
	
	if (entry.authors)
		$("#entryDetailsAuthors").html("by " + entry.authors);
	
	if (entry.reference)
		$("#entryDetailsReference").html(entry.reference);
	
	if (entry.pmid)
		$("#entryDetailsPMID").html("PubMed ID: <a href=\"https://www.ncbi.nlm.nih.gov/pubmed/" + entry.pmid
				+ "\" target=\"_blank\">" + entry.pmid + "</a>");
	
	if (entry.url)
		$("#entryDetailsUrl").html("URL: <a href=\"" + entry.url
				+ "\" target=\"_blank\">" + entry.url + "</a>");
	
	if (entry.implementation_url)
		$("#entryDetailsImplementationUrl").html("Implementation: <a href=\"" + entry.implementation_url
				+ "\" target=\"_blank\">" + entry.implementation_url + "</a>");
	
	if (entry.hasBibtex)
		$("#entryDetailsBibtex").html("<a href=\"" + ("bibtex/" + entry.id + ".bib" )
			+ "\" target=\"_blank\"><span class=\"glyphicon glyphicon-save\"></span> BibTeX</a>");
	
	$.each(entry.categories, function(i,d){
		var item = categoriesMap[d];
		
		var element = $("<span class=\"category-entry category-entry-span\""
			    + "data-tooltip=\"tooltip\"></span>");
		element.prop("title", item.descriptionPrefix
				? item.descriptionPrefix + item.description
				: item.description);
		element.append(item.content);
		
		$("#entryDetailsCategories").append(element);
		$("#entryDetailsCategories").append(" ");
	});
	
	// Find the similar entries
	updateSimilarEntries(entry);
	
	$("#entryDetailsModal").modal("show");
}


// Updates the information about similar entries in the details dialog
function updateSimilarEntries(entry) {
	var entryIndex = entry.i;
	
	$("#similarEntries").empty();
	$("#noSimilarEntries").hide();
	
	var similarEntries = [];
	
	$.each(entriesMap, function(i, d){
		var otherEntry = d;
		var otherIndex = otherEntry.i;
		
		if (otherIndex == entryIndex
			|| otherEntry.filtered)
			return;
		
		var dist = (otherIndex < entryIndex)
			? layoutNodeDistances[entryIndex][otherIndex]
			: layoutNodeDistances[otherIndex][entryIndex];
		
		var similarity = 1 - dist;	
			
		if (similarity < SIMILARITY_THRESHOLD) {
			return;
		} else {
			similarEntries.push({
				similarity: similarity,
				id: otherEntry.id,
				title: otherEntry.title,
				year: otherEntry.year
			});
		}
			
	});
	
	similarEntries.sort(function(a, b){
		return b.similarity - a.similarity;
	});
	
	$.each(similarEntries, function(i, d){
		// Add the link to the entry
		$("#similarEntries").append("<li>"
			+ "<a href=\"#\" data-id=\"" + d.id + "\" class=\"similar-entry-link\">"
			+ d.title + " (" + d.year + ")"
			+ "</a>"
			+ "<span class=\"similar-entry-distance text-muted\" title=\"Similarity value with regard to current weights\"> (similarity: " + d.similarity.toFixed(2) + ")</span>"  
			+"</li>");
	});
	
	if (!similarEntries.length) {
		$("#noSimilarEntries").show();
	}
}

// Clears the selection from the previously selected entry
function onDetailsModalHidden(){
	d3.select("#entriesContainer").selectAll(".content-entry.active")
		.classed("active", false);
}

// Handles the click on a similar entry link
function onSimilarEntryLinkClick(){
	// Emulate the effects of a closed dialog
	onDetailsModalHidden();
	
	// Get the ID of the similar entry
	var id = $(this).data("id");
	
	// Trigger the usual handler
	displayEntryDetails(id);
		
	// Return false to prevent the default handler for hyperlinks
	return false;
}

// Updates the counter of displayed entries
function updateDisplayedCount(number){
	$("#displayedEntriesCount").text(number);
}

// Loads the categories data
function loadCategories(){
	$.getJSON("data/categories.json", function(data){
		categories = data;
		categoriesMap = {};
		categoriesIndices = {};
		
		incompleteCategories = {};
		
		stats = { description: "BioVis Explorer", children: [] };
		statsMap = {};

		// Initialize the categories data	
		$.each(categories, function(i,d){
			initializeCategory(d, null, stats);
		});
		
		// Initialize the filters
		initializeCategoryFilters();
		
		// Initialize the new entry form
		initializeFormCategories();
		
		loadContent();
	});
}

// Initializes category data in a recursive fashion
function initializeCategory(item, parent, currentStats){
	// Check if category is disabled
	if (item.disabled)
		return;
	
	// Set parent category, if provided
	if (parent)
		item.parentCategory = parent;
	
	// First of all, include item into the maps
	categoriesMap[item.title] = item;
	categoriesIndices[item.title] = Object.keys(categoriesIndices).length;
	
	var statsEntry = { title: item.title, description: item.description, ids: {}};
	statsEntry.topCategory = currentStats.topCategory || item.title; 
	statsMap[item.title] = statsEntry;
	currentStats.children.push(statsEntry);
	
	if (item.type == "category") {
		statsEntry.children = [];
		
		// Check if any non-nested child entries are available
		var childEntries = $.grep(item.entries, function(d){ return d.type == "category-entry"});
		
		if (childEntries.length > 0) {
			// Save the flag for later
			item.hasChildEntries = true; 
			
			$.each(childEntries, function(i,d){
				// Modify child element, if needed
				if (item.childrenDescription)
					d.descriptionPrefix = item.childrenDescription;
				
				initializeCategory(d, item.title, statsEntry);
			});
		}
		
		// Check if any nested child entries are available
		// XXX: nested categories are not used at this time
		var childCategories = $.grep(item.entries, function(d){ return d.type == "category"});
		
		if (childCategories.length > 0) {
			// Save the flag for later
			item.hasChildCategories = true;
			
			$.each(childCategories, function(i,d){
				initializeCategory(d, item.title, statsEntry);
			});
		}
	}
}

// Initializes category filters based on guide questions
function initializeCategoryFilters(){
	var container = $("#categoriesList");
	
	$.each(categories, function(i, d){
		appendCategoryFilter(d, container);
	});
}

// Processes the current filter category in a recursive fashion
function appendCategoryFilter(item, currentContainer) {
	// Check if category is disabled
	if (item.disabled)
		return;
		
	if (item.type == "category") {
		var element = $("<li class=\"list-group-item category-item\"></li>");
		element.attr("data-category", item.title);
		element.append("<h5 class=\"category-title panel-label\">" + item.description + "</h5>");
		
		currentContainer.append(element);
				
		// Check if any non-nested child entries are available
		if (item.hasChildEntries) {
			var childrenContainer = $("<div class=\"category-entries-container\"></div>");
			childrenContainer.attr("data-category", item.title);
			element.append(childrenContainer);
			
			// Add the filter reset button
			var resetButton = $("<button type=\"button\" class=\"btn btn-default btn-xs reset-category-filter hidden\" title=\"Reset filters\">"
					+ "<span class=\"glyphicon glyphicon-remove\"></span>"
					+ "</button>");
			resetButton.attr("data-category", item.title);
			
			element.children(".category-title").append(resetButton);
			
			$.each(item.entries, function(i,d){
				if (d.type != "category-entry")
					return;
				
				appendCategoryFilter(d, childrenContainer);
			});
		}
		
		// Check if any nested child entries are available
		if (item.hasChildCategories) {
			var childrenContainer = $("<ul class=\"list-group nested-categories-list\"></ul>");
			element.append(childrenContainer);
			
			$.each(item.entries, function(i,d){
				if (d.type != "category")
					return;
				
				appendCategoryFilter(d, childrenContainer);
			});
		}
	} else if (item.type == "category-entry") {
		var element = $("<button type=\"button\" class=\"btn btn-default category-entry active\""
					    + "data-tooltip=\"tooltip\"></button>");
		element.attr("data-entry", item.title);
		element.prop("title", item.description);
		element.append(item.content);
		
		currentContainer.append(element);
		currentContainer.append(" ");
	}
}

// Category entries comparator used for sorting
function categoriesComparator(d1, d2){
	return categoriesIndices[d1] - categoriesIndices[d2];
}

// Loads and initializes the content
function loadContent(){
	$.getJSON("data/content.json", function(data){
		entriesMap = {};
		
		$.each(data, function(i,d){
			entriesMap[d.id] = d;
			
			// Load thumbnails
			d.thumb = new Image();
			d.thumb.onerror = function() {
			    // Fall back to default image
				delete d.thumb;
				
				// Check if a corresponding element should be updated
				// (due to asynchronous nature, rendering can occur before this error handler)
				//$("#entriesContainer .content-entry[data-id=" + d.id + "] img.thumbnail100")
				//	.attr("src", defaultThumb.src);
				// TODO: fix this code to use D3 / SVG
			}
			d.thumb.src = "thumbs/" + d.id + ".png";
			// Append the image element to the hidden placeholder for caching purposes
			$("#imageCache").append(d.thumb);
						
			// Sort category tags to keep the output order consistent
			d.categories.sort(categoriesComparator);
			
			// Extract the list of author names for further processing
			d.allAuthors = getAllAuthors(d.reference);
						
			// Add the flag to display the BibTeX link
			d.hasBibtex = true;

			// Make sure all categories are lowercase to avoid errors
			for (var i = 0; i < d.categories.length; i++) {
				d.categories[i] = d.categories[i].toLowerCase();
			}
			
			// Update hierarchical categories
			d.categoriesMap = {};
			$.each(d.categories, function(index, category){
				if (categoriesMap[category] != undefined) {
					var parent = categoriesMap[category].parentCategory;
					if (!d.categoriesMap[parent])
						d.categoriesMap[parent] = [];
					
					d.categoriesMap[parent].push(category);
				} else {
					console.error("Error: unknown category '" + category + "' detected for '"
							+ d.id + "'", d);
				}
			});
			
			// Update category stats
			$.each(d.categories, function(index, category){	
				if (statsMap[category] != undefined) {
					statsMap[category].ids[d.id] = true;
					
					// Since this is an entry associated with some category,
					// it means that the immediate parent of the category contains individual
					// categories as "leafs"
					if (categoriesMap[category] && categoriesMap[category].parentCategory) {
						var parent = categoriesMap[category].parentCategory;
						statsMap[parent].hasDirectEntries = true;
					}
				}
			});
		});
		
		calculateSorting();
		
		// Initialize the layout size
		updateLayoutSize();
		
		// Initialize the layout nodes
		initializeLayoutNodes();
		
		// Calculate source distances for the nodes
		calculateLayoutSourceDistances();
		
		// Calculate the layout for entries
		calculateLayout();
		
		// Configures the dissimilarity slider
		configureSimilaritySlider();
		
		// Process the statistics for the data set
		processStatistics();
		
		// Mark incomplete categories
		markIncompleteCategories();
		// Add auxiliary filters for incomplete categories
		appendAuxiliaryFilters();

		// Mark the entries belonging to incomplete categories
		markIncompleteCategoryEntries();
		
		renderTimeChart();
		
		configureTimeFilter();
		
		$("#totalTechniquesCount").text(Object.keys(entriesMap).length);
		
		// At this stage, the side panel height should be calculated properly
		updateLayoutSize();	
		
		resetVisualization();
		renderVisualization();
		updateDisplayedEntries();
		
		populateSummaryTable();
	});
}

// Extracts the list of author names from the technique reference
function getAllAuthors(reference){
	// Replacement dictionary for keeping author names consistent
	var dictionary = {
			"Anne-Mai Wassermann": "Anne Mai Wassermann",
			"Jennifer L. Gardy": "Jennifer Gardy",
			"Steven J. Jones": "Steven J.M. Jones",
			"David H. O'Connor": "David O'Connor",
			"Elisabeta G. Marai": "G. Elisabeta Marai",
			"Mike Smoot": "Michael E. Smoot",
			"R.A. Ruddle": "Roy A. Ruddle"
	};
		
	// Get the first part of the reference
	var authorsStr = reference.split(/\. <i>/)[0];
	if (!authorsStr || !authorsStr.length)
		return [];
	
	// Split into separate author names and trim (just in case)
	return authorsStr.split(/, and | and |, /).map(function(d, i){
		if (!d || !d.length)
			return d;
		
		var name = d.trim();
		if (dictionary[name])
			return dictionary[name];
		else
			return name;
	});
}

// Calculates a stable sorting order
function calculateSorting(){
	var ids = Object.keys(entriesMap);
	
	// Sort the entries by year in descending order,
	// entries without proper year value come last.
	// Secondary sorting field is ID (in ascending order), which corresponds to the first author surname.
	ids.sort(function(id1, id2){
		var d1 = entriesMap[id1];
		var d2 = entriesMap[id2];
		
		if (!d1.year && !d2.year)
			return 0;
		else if (!d1.year)
			return 1;
		else if (!d2.year)
			return -1;
		
		if (d2.year - d1.year)
			return d2.year - d1.year;
		
		if (d1.id && d2.id) 
			return d1.id.localeCompare(d2.id);
		else
			return 0;
	});
	
	$.each(ids, function(i,d){
		entriesMap[d].sortIndex = i;
	});
}

// Prepares category statistics
function processStatistics(){
	// Collect the data in bottom-up fashion
	var aggregate = function(category){
		if (category.children) {
			$.each(category.children, function(i,d){
				var tempResults = aggregate(d);
				if (!category.ids)
					return;
				
				$.each(tempResults, function(k, v){
					category.ids[k] = v;
				});
			});
			
		}
		
		if (category.ids)
			category.value = Object.keys(category.ids).length;
		
		return category.ids;
	};
	
	aggregate(stats);
}

// Detects and marks incomplete categories
function markIncompleteCategories() {
	// Reset the map of incomplete categories
	incompleteCategories = {};
	
	var totalCount = Object.keys(entriesMap).length;
	
	$.each(categoriesMap, function(i, d){
		// Prevent potential erroneous situations
		if (!d.children || !statsMap[i] || !statsMap[i].hasDirectEntries)
			return;
		
		// Check if category covers the whole set
		if (Object.keys(statsMap[i].ids).length < totalCount) {
			incompleteCategories[i] = true;
		}
		
	});
}


// Prepares the time chart data with year statistics and gaps
function prepareTimeChartData() {
	var yearEntries = [];
	
	var yearStats = {};
	var minYear = 1e6;
	var maxYear = -1e6;
	var maxYearCount = 0;
	$.each(entriesMap, function(k, v){
		if (!yearStats[v.year])
			yearStats[v.year] = 0;
		
		yearStats[v.year] += 1;
		
		if (yearStats[v.year] > maxYearCount)
			maxYearCount = yearStats[v.year]; 
		
		if (v.year > maxYear)
			maxYear = v.year;
		
		if (v.year < minYear)
			minYear = v.year;
	});
	
	for (var i = minYear; i <= maxYear; i++) {
		if (yearStats[i]) {
			yearEntries.push({
				year: i,
				gap: false,
				total: yearStats[i],
				current: yearStats[i]
			});
		}
	}
	
	// Detect the gaps between year entries
	// While the long gaps should be filled with special elements, short gaps should be filled with empty years
	var gaps = [];
	for (var i = 1; i < yearEntries.length; i++) {
		if (yearEntries[i].year - yearEntries[i-1].year >= YEAR_GAP_THRESHOLD) {
			gaps.push({
				year: yearEntries[i-1].year + 1,
				gap: true,
				duration: yearEntries[i].year - yearEntries[i-1].year - 1
			})
		} else if (yearEntries[i].year - yearEntries[i-1].year > 1) {
			for (var j = yearEntries[i-1].year + 1; j < yearEntries[i].year; j++) {
				gaps.push({
					year: j,
					gap: false,
					total: 0,
					current: 0
				});
			}	
		}
	}
	
	// Update the time chart data with gaps
	for (var i = 0; i < gaps.length; i++) {
		for (var j = 0; j < yearEntries.length; j++) {
			if (yearEntries[j].year > gaps[i].year) {
				yearEntries.splice(j, 0, gaps[i]);
				break;
			}
		}
	}
	
	// Finally, return the data and statistics
	return { timeChartData: yearEntries,
			 maxYearCount: maxYearCount };
}

// Renders the bar chart with statistics per year
function renderTimeChart() {
	// Prepare the chart data
	var chartData = prepareTimeChartData();
	timeChartData = chartData.timeChartData;
			
	// Setup SVG canvas
	var margin = { top: 1, right: 1, bottom: 1, left: 1};
	
	var outerWidth = Math.round($("#timeChart").width());
	var outerHeight = Math.round($("#timeChart").height());
	
	var canvasHeight = outerHeight - margin.top - margin.bottom;
	var canvasWidth = outerWidth - margin.left - margin.right;
	
	timeChartSvg = d3.select($("#timeChart").get(0)).append("svg:svg")
	.attr("id", "timeChartSvg")
	.classed("svg-vis", true)
	.attr("height", outerHeight + "px")
	.attr("width", outerWidth + "px")
	.attr("clip", [margin.top, outerWidth - margin.right, outerHeight - margin.bottom, margin.left].join(" "));
	
	timeChartSvg.append("rect")
	.classed("svg-fill", true)
	.attr("height", outerHeight)
	.attr("width", outerWidth)
	.style("fill", "white");
	
	timeChartSvg.append("rect")
	.classed("svg-frame-rect", true)
	.attr("height", outerHeight)
	.attr("width", outerWidth)
	.style("fill", "none")
	.style("stroke", "grey")
	.style("stroke-width", "1");
	
	var frame = timeChartSvg.append("g")
		.classed("frame-vis", true)
		.attr("id", "timeChartFrame")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
	
	// Prepare the clipping path for inner canvas
	frame.append("clipPath")
		.attr("id", "timeChartCanvasClip")
	.append("rect")
	    .attr("x", 0)
	    .attr("y", 0)
	    .attr("width", canvasWidth)
	    .attr("height", canvasHeight);
	
	var canvas = frame.append("g")
		.classed("canvas-vis", true)
		.attr("id", "timeChartCanvas")
		.attr("clip-path", "url(#timeChartCanvasClip)");
	
	// References to scales should be reused
	timeChartXScale = d3.scale.ordinal()
		.domain(timeChartData.map(function(d){return d.year;}))
		.rangeBands([0, canvasWidth]);
	
	timeChartHeight = canvasHeight;
	
	timeChartYScale = d3.scale.linear()
		.domain([0, chartData.maxYearCount])
		.range([0, timeChartHeight]);
	
	// Add the bars
	canvas.selectAll("g.time-chart-entry")
	.data(timeChartData)
	.enter().append("g")
	.classed("time-chart-entry", true)
	.classed("not-gap", function(d){return !d.gap;})
	.attr("transform", function(d){ return "translate(" + timeChartXScale(d.year) + ",0)"; })
	.attr("title", getTimeChartEntryDescription)
	.each(function(d, i){
		var group = d3.select(this);
		
		if (!d.gap) {
			// Create bars
			group.append("rect")
				.classed("time-chart-total", true)
				.attr("width", timeChartXScale.rangeBand())
				.attr("y", timeChartHeight - timeChartYScale(d.total))
				.attr("height", timeChartYScale(d.total));
		
			group.append("rect")
				.classed("time-chart-current", true)
				.attr("width", timeChartXScale.rangeBand())
				.attr("y", timeChartHeight - timeChartYScale(d.current))
				.attr("height", timeChartYScale(d.current));
			
		} else {
			// Create an ellipsis mark
			group.append("text")
				.classed("time-chart-gap", true)
				.text("…")
				.attr("x", timeChartXScale.rangeBand()/2)
				.attr("y", timeChartHeight/2)
				.attr("text-anchor", "middle");
		}
		
	});
}

// Creates the text description for a time chart entry
function getTimeChartEntryDescription(entry){
	if (!entry.gap) {
		return entry.year + ": "
			+ entry.current + " techniques displayed, "
			+ entry.total + " techniques in total";
	} else {
		return null;
	}
}


// Appends auxiliary filter buttons to categories 
// that do not cover the whole entries set
function appendAuxiliaryFilters(){
	var content = "<span class=\"content-entry-label\">...</span>";
	
	$("#categoriesList .category-item").each(function(i,d){
		var element = $(d);
		var title = element.attr("data-category");
		
		if (!incompleteCategories[title])
			return;
		
		var button = $("<button type=\"button\" class=\"btn btn-default category-entry category-other active\""
			    + "data-tooltip=\"tooltip\"></button>");
		button.attr("data-category", title);
		button.prop("title", "Other");
		button.append(content);
		
		element.find(".category-entries-container").append(button);
	});
}

// Updates the entries with tags of corresponding "incomplete" categories
function markIncompleteCategoryEntries(){
	$.each(entriesMap, function(id, entry){
		entry.incompleteCategories = getIncompleteCategories(entry);
	});
	
}

// Returns a map of "incomplete" categories that entry is relevant to
function getIncompleteCategories(entry){
	var candidates = {};
	
	for (var i in incompleteCategories){
		candidates[i] = true;
	}
	
	for (var i = 0; i < entry.categories.length; i++){
		if (categoriesMap[entry.categories[i]]) {
			var parent = categoriesMap[entry.categories[i]].parentCategory;
			delete candidates[parent];
		}
	}
	
	return candidates;
}

// Updates the displayed set of entries
function updateDisplayedEntries(){
	if (!layoutNodes)
		return;
	
	// Remove the overlay message
	$("#entriesContainer .overlay-message").remove();
	
	// Filter out all entries by default
	$.each(entriesMap, function(i,d){
		d.filtered = true;
	});
		
	// Remove the tooltips just in case
    $(".tooltip").remove();
	
	// Get the set of active filters
	var activeFilters = {};
	$(".category-entry.active:not(.category-other)").each(function(){
		var category = $(this).data("entry");
		var parent = categoriesMap[category].parentCategory;
		if (!activeFilters[parent])
			activeFilters[parent] = {};
		 
		activeFilters[parent][category] = true;
	});
		
	// Get the set of inactive filters for "Other" buttons
	var inactiveOthers = {};
	$(".category-other:not(.active)").each(function(){
		inactiveOthers[$(this).data("category")] = true;
	});
	
	// Get the time filter range
	var indices = $("#timeFilter").val();
	var yearMin = timeFilterEntries[parseInt(indices[0])];
	var yearMax = timeFilterEntries[parseInt(indices[1])];
		
	// Filter the entries
	var eligibleEntries = $.map(entriesMap, function(entry, index){
		// First of all, check for search text relevancy
		if (!isRelevantToSearch(entry))
			return null;
		
		// Check the time value
		if (entry.year < yearMin || entry.year > yearMax)
			return null;
		
		// Check if entry is not relevant to inactive "other" filters
		for (var i in entry.incompleteCategories) {
			if (inactiveOthers[i])
				return null;
		}
		
		// Check if all entry's categories are disabled
		for (var k in entry.categoriesMap) {
			if (!activeFilters[k] || !Object.keys(activeFilters[k]).length)
				return null;
			
			var found = false;
			for (var i = 0; i < entry.categoriesMap[k].length; i++) {
				var currentCategory = entry.categoriesMap[k][i]; 
				
				if (activeFilters[k][currentCategory]) {
					found = true;
					break;
				}
			}
			
			if (!found)
				return null;
		}
		
		return entry;
	});
	
	// Update the filtered flag
	$.each(eligibleEntries, function(i,d){
		d.filtered = false;
	});
	
	// Update the number of visible entries
	updateDisplayedCount(eligibleEntries.length);
	
	// Update the time chart
	updateTimeChart(eligibleEntries);
	
	// Update the visible entries
	d3.selectAll("#entriesContainer .content-entry")
		.data(layoutNodes)
		.classed("filtered-out", function(d){return d.filtered;});
	
	// If necessary, add a message about missing results
	if (!eligibleEntries.length) {
		$("#entriesContainer").append("<p class=\"text-muted overlay-message\">No eligible entries found</p>");
	}
	
	// Update selection effects
	updateEntrySelectionEffects();

	// Update highlighting effects
	updateEntryHoverEffects();
}


// Updates the time chart
function updateTimeChart(eligibleEntries) {

	// Update the time chart
	var yearStats = {};
	$.each(eligibleEntries, function(i,d){
		if (!yearStats[d.year])
			yearStats[d.year] = 0;
		
		yearStats[d.year] += 1;
	});
	
	$.each(timeChartData, function(i, d){
		if (d.gap)
			return;
		
		d.current = yearStats[d.year] || 0;
	});
	
	timeChartSvg.selectAll("g.time-chart-entry.not-gap")
	.each(function(d, i){
		if (d.gap)
			return;
		
		var group = d3.select(this);
		
		group.select(".time-chart-current")
			.transition()
				.attr("y", timeChartHeight - timeChartYScale(d.current))
				.attr("height", timeChartYScale(d.current));
		
		group.attr("title", getTimeChartEntryDescription(d));
		// Force Bootstrap tooltip update
		group.attr("data-original-title", getTimeChartEntryDescription(d));
	});
}



// Configures the time filter
function configureTimeFilter() {
	// Get the set of time values
	var values = {};
	$.each(entriesMap, function(i, d){
		if (!isFinite(parseInt(d.year)))
			return;
		
		values[d.year] = true;
	});
	
	// Get the range of time values
	timeFilterEntries = $.map(values, function(d, i){
		return parseInt(i);
	}).sort(function(a, b) {
		  return a - b;
	});
	
	// Update labels
	$("#timeFilterMin").text(timeFilterEntries[0]);
	$("#timeFilterMax").text(timeFilterEntries[timeFilterEntries.length-1]);
	
	// Setup the slider
	$("#timeFilter").noUiSlider({
		start: [0, timeFilterEntries.length-1],
		step: 1,
		range: {
			"min": 0,
			"max": timeFilterEntries.length-1
		},
		behaviour: "drag",
		connect: true
	}).on("slide", onTimeFilterUpdate);
}

// Updates the labels and triggers time filtering
function onTimeFilterUpdate() {
	var indices = $("#timeFilter").val();
	
	$("#timeFilterMin").text(timeFilterEntries[parseInt(indices[0])]);
	$("#timeFilterMax").text(timeFilterEntries[parseInt(indices[1])]);
	
	updateDisplayedEntries();
}

// Checks if current entry is relevant to the current search text
function isRelevantToSearch(entry){
	var query = searchText ? searchText.toLowerCase().trim() : null;
	if (!query)
		return true;
	
	// Note: "allAuthors" should be included in order to support alternative name spellings
	var keys = ["id", "title", "year", "authors", "allAuthors", "reference", "pmid", "url", "implementation_url", "categories"];
	for (var i = 0; i < keys.length; i++) {
		if (String(entry[keys[i]]).toLowerCase().indexOf(query) != -1) {
			return true;
		}
	}
	
	// Just in case, try the the normalized author names as well
	for (var i = 0; i < entry.allAuthors.length; i++) {
		if (String(entry.allAuthors[i]).toLowerCase().indexOf(query) != -1) {
			return true;
		}
	}
	
	// Check the category descriptions as well
	for (var i = 0; i < entry.categories.length; i++){
		if (categoriesMap[entry.categories[i]].description.toLowerCase().indexOf(query) != -1) {
			return true;
		}
	}
	
	return false;
}

// Initializes the layout nodes
function initializeLayoutNodes() {
	layoutNodes = [];
	var n = Object.keys(entriesMap).length;
	for (var k in entriesMap){
		var d = entriesMap[k];
		
		// Additional fields used by the layout
		d.i = layoutNodes.length;
		d.x = d.y = Math.min(LAYOUT_WIDTH, LAYOUT_HEIGHT) / n * d.sortIndex;
		
		layoutNodes.push(d);
	}
	
}

// Compute the classical MDS
function calculateMDS() {
	var n = layoutNodeDistances.length;
	
	// Initializes the negative squared distance matrix
	var D = [];
	
	// In our case, the matrix is symmetric, so row means == column means
	var rowMeans = [];
		
	for (var i = 0; i < n; i++) {
		var row = [];
		
		for (var j = 0; j < n; j++) {
			var d = (j <= i)
				? layoutNodeDistances[i][j] : layoutNodeDistances[j][i];
			
			row.push(- d * d / 2);	
		}
		
		// Add the row to the matrix
		D.push(row);
		
		// Calculate the row mean
		rowMeans.push(numeric.sum(row) / n);
	}
	
	// Calculate the global mean
	var globalMean = numeric.sum(rowMeans) / n;
	
	// Double center the matrix
	for (var i = 0; i < n; i++) {
		for (var j = 0; j < n; j++) {
			D[i][j] = D[i][j] - rowMeans[i] * 2 + globalMean;
		}
	}
	
	// Decompose the matrix
	var svd = numeric.svd(D);
	// svd.S is actually squared, so take a root
	var S = numeric.sqrt(svd.S);
	
	var projectedCoords = [];
	
	for (var i = 0; i < n; i++) {
		// Multiply a row from svd.U with S and then trim it to the first two dimensions
		projectedCoords.push(numeric.mul(svd.U[i], S).splice(0, 2));
	}
	
	// Calculate range for both dimensions
	var range = [[0, 0], [0, 0]];
	var T = numeric.transpose(projectedCoords);
	
	for (var i = 0; i < range.length; i++) {
		range[i][0] = _.min(T[i]);
		range[i][1] = _.max(T[i]);
	}
	
	return { coords: projectedCoords, range: range };
}


// Calculates the layout for entries
function calculateLayout() {
	// Calculate node distances
	calculateLayoutDistances();
	
	// Compute MDS
	var mds = calculateMDS();
	
	// Prepare scales to transform the coordinates from
	// normalized MDS values to the layout space
	var mdsXScale = d3.scale.linear()
		.range([GLYPH_SIZE, LAYOUT_WIDTH - GLYPH_SIZE])
		.domain(mds.range[0]);

	var mdsYScale = d3.scale.linear()
		.range([GLYPH_SIZE, LAYOUT_HEIGHT - GLYPH_SIZE])
		.domain(mds.range[1]);
	
	// Set the node positions
	for (var i = 0; i < layoutNodes.length; i++) {
		layoutNodes[i].x = mdsXScale(mds.coords[i][0]);
		layoutNodes[i].y = mdsYScale(mds.coords[i][1]);
		
		// The previous positions should be reset
		delete layoutNodes[i].px;
		delete layoutNodes[i].py;
	}
	
	// Create the layout object
	var layout = d3.layout.force()
	.nodes(layoutNodes)
	.size([LAYOUT_WIDTH, LAYOUT_HEIGHT])
	.gravity(0.0)
	.charge(0)
	//.friction(0.5)
	.on("tick", onLayoutTick);
	//.on("end", checkAllBoundaries);
	
	layout.start();
	
	// Run the layout for a limited number of steps
	for (var i = 0; i < 100; i++) {
		layout.tick();
	}
	
	layout.stop();
	
	// Calculate the resulting domains for coordinates
	var xMin = 1e10, xMax = -1e10, yMin = 1e10, yMax = -1e10;
	for (var i = 0; i < layoutNodes.length; i++) {
		xMin = Math.min(xMin, layoutNodes[i].x);
		xMax = Math.max(xMax, layoutNodes[i].x);
		
		yMin = Math.min(yMin, layoutNodes[i].y);
		yMax = Math.max(yMax, layoutNodes[i].y);
	}
	
	xDomain = [xMin, xMax];
	yDomain = [yMin, yMax];
}

// Handles the layout step update
function onLayoutTick(e) {
	if (!layoutNodes)
		return;
	
	// Check collisions
	var quadtree = d3.geom.quadtree(layoutNodes);
	$.each(layoutNodes, collide(0.1, quadtree));
		
	// Check boundaries
	$.each(layoutNodes, checkBoundaries);
}

// Handles the layout end event
function checkAllBoundaries() {
	if (!layoutNodes)
		return;
	
	$.each(layoutNodes, checkBoundaries);
}

// Calculate source distances for the nodes
function calculateLayoutSourceDistances() {
	if (!layoutNodes)
		return;
	
	// To normalize the difference in year values,
	// calculate and store the range
	var yearMin = 1e5, yearMax = 0;
	$.each(entriesMap, function(i, d){
		var year = parseInt(d.year);
		
		if (!isFinite(d.year))
			return;
		
		if (year > yearMax)
			yearMax = year;
		
		if (year < yearMin)
			yearMin = year;
	});
	
	yearRange = yearMax - yearMin;
	
	layoutNodeSourceDistances = [];
	
	var n = layoutNodes.length;
	
	for (var i = 0; i < n; i++) {
		var row = [];
		
		for (var j = 0; j <= i; j++) {
			if (i == j)
				row.push({year: 0, dataTypes: 0, dataProperties: 0, tasks: 0, authors: 0});
			else
				row.push(getSourceDistance(layoutNodes[i], layoutNodes[j]));
		}
		
		layoutNodeSourceDistances.push(row);
	}
}

// Calculates the Jaccard distance value for provided arrays
function getJaccardDist(array1, array2) {
	var union = _.union(array1, array2).length;
	
	if (union == 0)
		return 0;

	var intersection = _.intersection(array1, array2).length;
	
	return 1 - intersection/union;
}

// Filters the provided array of categories with regard to parent category
function getFilteredCategories(categories, parent) {
	return categories.filter(function(v){
		return (parent == categoriesMap[v].parentCategory);
	});
}

// Calculates the difference between two layout nodes based on the entry data
function getSourceDistance(entry1, entry2) {
	var dist = {};
	
	// Use the difference in year values
	dist.year = Math.abs(parseInt(entry1.year) - parseInt(entry2.year)) / yearRange;
	
	// Use the difference in data type categories
	dist.dataTypes = getJaccardDist(
			getFilteredCategories(entry1.categories, "data-types"),
			getFilteredCategories(entry2.categories, "data-types"));
	
	// Use the difference in data property categories
	dist.dataProperties = getJaccardDist(
			getFilteredCategories(entry1.categories, "data-properties"),
			getFilteredCategories(entry2.categories, "data-properties"));
	
	// Use the difference in task categories
	dist.tasks = getJaccardDist(
			getFilteredCategories(entry1.categories, "tasks"),
			getFilteredCategories(entry2.categories, "tasks"));
	
	// Use the difference in author sets
	dist.authors = getJaccardDist(entry1.allAuthors, entry2.allAuthors);
		
	return dist;
}

// Calculates distances between layout nodes
function calculateLayoutDistances(){
	if (!layoutNodes)
		return;
	
	layoutNodeDistances = [];
	
	var n = layoutNodes.length;
	
	for (var i = 0; i < n; i++) {
		var row = [];
		
		for (var j = 0; j <= i; j++) {
			if (j == i)
				row.push(0);
			else
				row.push(getDistance(i, j));
		}
		
		layoutNodeDistances.push(row);
	}
}

// Calculates the difference between two layout nodes based on the entry data and weights
function getDistance(i, j) {
	// If the weights are all 0, simply return the default value
	if (distanceWeightNorm < 1e-3)
		return 0;
	
	if (!layoutNodeSourceDistances
		|| !layoutNodeSourceDistances[i]
		|| !layoutNodeSourceDistances[i][j])
		return 0;
	
	var srcDist = layoutNodeSourceDistances[i][j];
	
	var dist = 0.0;
	
	for (var k in distanceWeights) {
		dist += srcDist[k] * distanceWeights[k];
	}
		
	return dist / distanceWeightNorm;
}

// Resolves collisions between the layout node
// corresponding to the current glyph and all other nodes
// Adapted from D3 examples
function collide(alpha, quadtree) {
	if (!layoutNodes)
		return;
	
	return function(i, d) {
		if (!layoutNodes || layoutNodes.length <= i || !layoutNodes[i])
			return;
		
		var node = layoutNodes[i];
				
		// The unsafe region boundaries for this node beyond which collisions are impossible
		var nx1 = node.x - GLYPH_SIZE - GLYPH_PADDING,
        	nx2 = node.x + GLYPH_SIZE + GLYPH_PADDING,
        	ny1 = node.y - GLYPH_SIZE - GLYPH_PADDING,
        	ny2 = node.y + GLYPH_SIZE + GLYPH_PADDING;
		
	    quadtree.visit(function(quad, x1, y1, x2, y2) {
	      if (quad.point && quad.point !== node && quad.point.i < node.i) {
	        var x = node.x - quad.point.x,
	            y = node.y - quad.point.y,
	            // The current distance
	            l = Math.sqrt(x * x + y * y),
	            // The expected distance (minimum distance threshold)
	            r = GLYPH_SIZE + 2 * GLYPH_PADDING;
	        
	        if (l < r) {
	        	if (l < 1e-3) {
					l = 1e-3;
				}
	        	
	        	// Calculate translation vectors	
	        	var normDist = (l - r) / l * alpha;
	        					
	        	var normX = x * normDist;
				var normY = y * normDist;
				
				// Handle the case with very small differences
				if (Math.abs(normX) < 1e-3 && Math.abs(normY) < 1e-3) {
					normX = 1e-3 * normDist;
					normY = 1e-3 * normDist;
				}
				
				// Randomize the angle of the movement
				// to make sure the glyphs do not simply stay on the same Y coordinate
				var vecLength = Math.sqrt(normX * normX + normY * normY);
				normX *= Math.random();
				var sign = Math.sign(normY);
				normY = sign * Math.sqrt(vecLength * vecLength - normX * normX);
								
				node.x -= normX;
				node.y -= normY;
				quad.point.x += normX;
				quad.point.y += normY;	
	        }
	      }
	      return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
	    });
	  };
}

// Ensures that the glyph stays within the container boundaries
function checkBoundaries(i, d) {
	if (!layoutNodes || layoutNodes.length <= i || !layoutNodes[i])
		return;
	
	var node = layoutNodes[i];
	
	if (node.x < 0 + GLYPH_PADDING + GLYPH_SIZE / 2) {
		node.x = 0 + GLYPH_PADDING + GLYPH_SIZE / 2;
	}
	if (node.x + GLYPH_SIZE / 2 > LAYOUT_WIDTH - GLYPH_PADDING) {
		node.x = LAYOUT_WIDTH - GLYPH_PADDING - GLYPH_SIZE / 2;
	}
			
	if (node.y < 0 + GLYPH_PADDING + GLYPH_SIZE / 2) {
		node.y = 0 + GLYPH_PADDING + GLYPH_SIZE / 2;
	}
	if (node.y + GLYPH_SIZE / 2 > LAYOUT_HEIGHT - GLYPH_PADDING) {
		node.y = LAYOUT_HEIGHT - GLYPH_PADDING - GLYPH_SIZE / 2;
	}
}


// Resets the hover-based item filtering and highlighting status
function resetEntryHover() {
	d3.select("#visEntries").selectAll(".content-entry.highlighted")
		.classed("highlighted", false);

	resetEntryHoverEffects();
}

// Resets the effects of hover-based item filtering and highlighting
function resetEntryHoverEffects() {
	d3.select("#visEntries").selectAll(".content-entry.blurred")
		.classed("blurred", false);
	
	d3.selectAll("#visEdgesOverlay .edge-highlight, #visLabelsOverlay .distance-label").remove();
}


// Filters the items based on the hovered item, if requested
function onEntryHoverOn() {
	resetEntryHover();
		
	if (!FILTER_DISSIMILAR)
		return;
	
	// Highlight the item
	d3.select(this).classed("highlighted", true);
	
	// Update the visual effects
	updateEntryHoverEffects();	
}

// Updates the rendered highlight for corresponding items
function updateEntryHoverEffects() {
	resetEntryHoverEffects();
	
	// Get the directly highlighted item first 
	var directItem = d3.select("#visEntries").select(".content-entry.highlighted:not(.filtered-out)");
	
	if (directItem.empty())
		return;
	
	var id = $(directItem.node()).data("id");
	
	if (!entriesMap[id])
		return;
		
	var entry = entriesMap[id];
	var entryIndex = entry.i;
	
	// Find and update the filtered entries as well as related entries
	$("#visEntries .content-entry:not(.filtered-out)").each(function(i, d){
		var otherId = $(d).data("id");
		if (!entriesMap[otherId])
			return;
		
		var otherEntry = entriesMap[otherId];
		var otherIndex = otherEntry.i;
		
		if (otherIndex == entryIndex)
			return;
		
		var dist = (otherIndex < entryIndex)
			? layoutNodeDistances[entryIndex][otherIndex]
			: layoutNodeDistances[otherIndex][entryIndex];
		
		var similarity = 1 - dist;	
			
		if (similarity < SIMILARITY_THRESHOLD) {
			d3.select(d).classed("blurred", true);
		} else {
			// Render the edge between entries
			var thisX = xScale(entry.x);
			var thisY = yScale(entry.y);
			var thatX = xScale(otherEntry.x);
			var thatY = yScale(otherEntry.y);
			
			d3.select("#visEdgesOverlay").append("line")
				.classed("edge-highlight", true)
				.attr("x1", thisX)
				.attr("y1", thisY)
				.attr("x2", thatX)
				.attr("y2", thatY);
			
//			// Render the distance value between entries
//			var labelX = (thisX + thatX) / 2;
//			var labelY = (thisY + thatY) / 2;
//			
//			// Make sure the second point lies to the right
//			var diffX = thatX - thisX;
//			var diffY = thatY - thisY;
//			if (thisX <= thatX) {
//				diffX *= -1;
//				diffY *= -1;
//			}
//			
//			var labelAngle = Math.atan2(diffY, diffX) / (Math.PI / 180);
//			if (isNaN(labelAngle))
//				labelAngle = 0;
//			
//			console.log("label", dist.toFixed(2), labelAngle);
//			
//			// Fix the angle just in case
//			if (labelAngle >= 90)
//				labelAngle -= 180;
//			else if (labelAngle <= -90)
//				labelAngle += 180;
//			
//			d3.select("#visLabelsOverlay").append("text")
//				.classed("distance-label", true)
//				.text(dist.toFixed(2))
//				.attr("x", labelX)
//				.attr("y", labelY - 3)
//				.attr("transform", "rotate(" + labelAngle + " "  + labelX + " " + (labelY - 3) + ")")
//				.attr("text-anchor", "middle");
			
			d3.select("#visLabelsOverlay").append("g")
				.classed("distance-label", true)
				.attr("transform", "translate(" + thatX + "," + (thatY + GLYPH_SIZE * 0.8) + ")")
				.each(function(){
					d3.select(this).append("rect")
						.attr("x", -GLYPH_SIZE / 2)
						.attr("y", -8)
						.attr("width", GLYPH_SIZE)
						.attr("height", 16)
						.attr("rx", 4)
						.attr("ry", 4);
					
					d3.select(this).append("text")
						.text(similarity.toFixed(2))
						.attr("y", 4)
						.attr("text-anchor", "middle");
				});
		}
			
	});
}

// Removes the hover-based filters and highlighting
function onEntryHoverOff() {
	resetEntryHover();
}

// Handles the right-click event for entries
function onEntryRightClick() {
	// Check if the entry was marked as selected
	var wasSelected = d3.select(this).classed("selected-directly");
	
	// Reset the selected class for all entries just in case
	resetEntrySelection();
	
	// If the entry was previously selected, return
	if (wasSelected)
		return false;
		
	d3.select(this)
		.classed("selected-directly", true);
	
	// Update the effects
	updateEntrySelectionEffects();
	
	// Return false to prevent the default handler
	return false;
}

// Resets the item selection status
function resetEntrySelection() {
	d3.select("#visEntries").selectAll(".content-entry.selected-directly")
		.classed("selected-directly", false);

	resetEntrySelectionEffects();
}

// Resets the effects of item selection
function resetEntrySelectionEffects() {
	d3.select("#visEntries").selectAll(".content-entry.selected-indirectly")
		.classed("selected-indirectly", false);
	
	d3.selectAll("#visEdgesOverlay .edge-selection").remove();
}

// Updates the rendered selection for corresponding items
function updateEntrySelectionEffects() {
	resetEntrySelectionEffects();
	
	// Get the directly highlighted item first 
	var directItem = d3.select("#visEntries").select(".content-entry.selected-directly:not(.filtered-out)");
	
	if (directItem.empty())
		return;
	
	var id = $(directItem.node()).data("id");
	
	if (!entriesMap[id])
		return;
		
	var entry = entriesMap[id];
	var entryIndex = entry.i;
	
	// Find and update the related entries
	$("#visEntries .content-entry:not(.filtered-out)").each(function(i, d){
		var otherId = $(d).data("id");
		if (!entriesMap[otherId])
			return;
		
		var otherEntry = entriesMap[otherId];
		var otherIndex = otherEntry.i;
		
		if (otherIndex == entryIndex)
			return;
		
		var dist = (otherIndex < entryIndex)
			? layoutNodeDistances[entryIndex][otherIndex]
			: layoutNodeDistances[otherIndex][entryIndex];
		
		var similarity = 1 - dist;	
			
		if (similarity < SIMILARITY_THRESHOLD) {
			return;
		} else {
			// Mark the entry as indirectly selected
			d3.select(d).classed("selected-indirectly", true);
			
			// Render the edge between entries
			var thisX = xScale(entry.x);
			var thisY = yScale(entry.y);
			var thatX = xScale(otherEntry.x);
			var thatY = yScale(otherEntry.y);
			
			d3.select("#visEdgesOverlay").append("line")
				.classed("edge-selection", true)
				.attr("x1", thisX)
				.attr("y1", thisY)
				.attr("x2", thatX)
				.attr("y2", thatY);
		}
			
	});
}


// Configures the similarity slider
function configureSimilaritySlider() {
	// Get the maximum distance value from the matrix
	var maxDistance = 0;
	for (var i = 0; i < layoutNodeDistances.length; i++) {
		for (var j = 0; j < i; j++) {
			if (layoutNodeDistances[i][j] > maxDistance)
				maxDistance = layoutNodeDistances[i][j];
		}
	}
	
	// Setup the slider
	$("#similaritySlider").noUiSlider({
		start: SIMILARITY_THRESHOLD,
		range: {
			"min": 0.0,
			"max": 1.0
		}
	}).on("slide", onSimilaritySliderUpdate);
	
	// Set the initial value for the label
	$("#similarityThreshold").text(SIMILARITY_THRESHOLD.toFixed(2));
}

// Handles a similarity slider update
function onSimilaritySliderUpdate(){
	SIMILARITY_THRESHOLD = parseFloat($("#similaritySlider").val());
	
	// Update the label
	$("#similarityThreshold").text(SIMILARITY_THRESHOLD.toFixed(2));
	
	// Update selection effects
	updateEntrySelectionEffects();

	// Update highlighting effects
	updateEntryHoverEffects();
}

// Sets up weight sliders
function setupWeightSliders() {
	// Start with updating the labels
	//$(".weight-label").text("1.00");
	
	$(".weight-slider").each(function(){
		// Setup a slider
		$(this).noUiSlider({
			start: 1.0,
			step: 0.2,
			range: {
				"min": 0.0,
				"max": 1.0
			}
		}).on("slide", onWeightSliderUpdate);
	});
}

// Handles a weight slider update
function onWeightSliderUpdate(event, strValue) {
	var value = parseFloat(strValue);
	var slider = $(this);
	
	// Get the weight attribute title
	var attribute = slider.data("weight");
	
	// Update the corresponding label
	//$(".weight-label[data-weight=" + attribute + "]").text(value.toFixed(2));
	
	// Update the stored weight
	if (attribute in distanceWeights) {
		distanceWeights[attribute] = value;
		
		// Update the norm
		distanceWeightNorm = _.reduce(distanceWeights, function(acc, d){ return acc + d; }, 0);
		
		// Check if the provided weights are suitable for computations
		if (distanceWeightNorm > 1e-3) {
			// Update the visualization
			onDistanceWeightsUpdate();
		} else {
			// Reset the slider to a fallback value
			slider.val(0.2);
		}
		
	}
	
	// Update the visibility of the reset button
	updateResetWeightsButton();
	
}

// Updates the distance values, recomputes the layout and updates the visualization
function onDistanceWeightsUpdate() {
	// Check if the provided weights are suitable for computations
	if (distanceWeightNorm < 1e-3)
		return;
	
	// Update the layout for entries
	calculateLayout();
	updateEntriesCoordinates();
		
	// Update selection effects
	updateEntrySelectionEffects();

	// Update highlighting effects
	updateEntryHoverEffects();
}

// Resets the visualization
function resetVisualization() {
	$("#entriesContainer").empty();
	zoomHandler = null;
}

// Renders the visualization
function renderVisualization() {
	if (!layoutNodes)
		return;
	
	var container = $("#entriesContainer");
	
	// First and foremost, add the (hidden) centering button
	container.append("<button id=\"resetPanZoom\" type=\"button\" class=\"btn btn-default btn-xs hidden\" title=\"Center the visualization and reset zooming\">"
			+ "Center"
			+ "</button>");
	
	// Setup SVG canvas
	var margin = { top: 2, right: 2, bottom: 2, left: 2};
		
//	// Width must take padding values for the container and its wrapper into account
//	var outerWidth = $(window).width() - $(".sidebar-fixed").width()
//		- parseInt(container.css("padding-left")) * 2
//		- parseInt(container.css("padding-right")) * 2;
//	
//	//var outerHeight = Math.ceil(container.width() / 
//	//		($(window).width() / $(window).height()));
//	var outerHeight = $(window).height() - $(".navbar.custom-navbar").height()
//		- parseInt($(".navbar.custom-navbar").css("margin-bottom")) * 2;
//	
//	if (outerHeight > parseInt(container.css("max-height")))
//		outerHeight = parseInt(container.css("max-height"));
	
	var outerHeight = LAYOUT_HEIGHT;
	var outerWidth = LAYOUT_WIDTH;
	
	var canvasHeight = outerHeight - margin.top - margin.bottom;
	var canvasWidth = outerWidth - margin.left - margin.right;
	
	var svg = d3.select(container.get(0)).append("svg:svg")
	.attr("id", "visSvg")
	.classed("svg-vis", true)
	.attr("height", outerHeight + "px")
	.attr("width", outerWidth + "px")
	.attr("clip", [margin.top, outerWidth - margin.right, outerHeight - margin.bottom, margin.left].join(" "));
	
	svg.append("filter")
	.attr("id", "shadow")
	.attr("width", "150%")
	.attr("height", "150%")
	.each(function(){
		d3.select(this).append("feGaussianBlur")
			.attr("in", "SourceGraphic")
			.attr("stdDeviation", "2");
		
		d3.select(this).append("feOffset")
			.attr("dx", "2")
			.attr("dy", "2");
	});
		
	svg.append("rect")
	.classed("svg-fill", true)
	.attr("height", outerHeight)
	.attr("width", outerWidth)
	.style("fill", "white");
	
	svg.append("rect")
	.classed("svg-frame-rect", true)
	.attr("height", outerHeight)
	.attr("width", outerWidth)
	.style("fill", "none")
	.style("stroke", "lightgrey")
	.style("stroke-width", "1");
	
	var frame = svg.append("g")
		.classed("frame-vis", true)
		.attr("id", "visFrame")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
	
	// Prepare scales (references should be reused for handling zoom)
	xScale = d3.scale.linear()
		.range([0, canvasWidth])
		.domain(xDomain);
	
	yScale = d3.scale.linear()
		.range([0, canvasHeight])
		.domain(yDomain);
	
	// Prepare the clipping path for inner canvas
	frame.append("clipPath")
		.attr("id", "visCanvasClip")
	.append("rect")
	    .attr("x", 0)
	    .attr("y", 0)
	    .attr("width", canvasWidth)
	    .attr("height", canvasHeight);
	
	var canvas = frame.append("g")
		.classed("canvas-vis", true)
		.attr("id", "visCanvas")
		.attr("clip-path", "url(#visCanvasClip)");
	
	// Add the group for edge overlays
	canvas.append("g")
		.classed("overlay", true)
		.attr("id", "visEdgesOverlay");
	
	// Add the group for actual entries
	var visEntries = canvas.append("g")
		.attr("id", "visEntries");
	
	// Add the group for label overlays
	canvas.append("g")
		.classed("overlay", true)
		.attr("id", "visLabelsOverlay");
	
	// Render items
	visEntries.selectAll("g.content-entry")
		.data(layoutNodes)
		.enter().append("g")
		.classed("content-entry", true)
		.attr("data-id", function(d){return d.id;})
		.attr("title", function(d){return d.title + " (" + d.year + ")";})
		.attr("transform", visItemTransform)
		.each(function(d, i){
			// The first three rectangles are used for shadows and highlights
			d3.select(this).append("rect")
				.classed("content-entry-shadow", true)
				.attr("x", - GLYPH_SIZE / 2)
				.attr("y", - GLYPH_SIZE / 2)
				.attr("filter", "url(#shadow)")
				.attr("width", GLYPH_SIZE)
				.attr("height", GLYPH_SIZE)
				.attr("rx", 4)
				.attr("ry", 4);
			
			d3.select(this).append("rect")
				.classed("content-entry-hover", true)
				.attr("x", - GLYPH_SIZE / 2)
				.attr("y", - GLYPH_SIZE / 2)
				.attr("filter", "url(#shadow)")
				.attr("width", GLYPH_SIZE)
				.attr("height", GLYPH_SIZE)
				.attr("rx", 4)
				.attr("ry", 4);
			
			d3.select(this).append("rect")
				.classed("content-entry-active", true)
				.attr("x", - GLYPH_SIZE / 2)
				.attr("y", - GLYPH_SIZE / 2)
				.attr("filter", "url(#shadow)")
				.attr("width", GLYPH_SIZE)
				.attr("height", GLYPH_SIZE)
				.attr("rx", 4)
				.attr("ry", 4);
					
			// The actual entry box
			d3.select(this).append("rect")
				.classed("content-entry-rect", true)
				.attr("x", - GLYPH_SIZE / 2)
				.attr("y", - GLYPH_SIZE / 2)
				.attr("width", GLYPH_SIZE)
				.attr("height", GLYPH_SIZE)
				.attr("rx", 4)
				.attr("ry", 4);
				
			d3.select(this).append("svg:image")
				.classed("content-entry-thumbnail", true)
				.attr("xlink:href", d.thumb ? d.thumb.src : defaultThumb.src)
				.attr("x", - GLYPH_THUMBNAIL_SIZE / 2)
				.attr("y", - GLYPH_THUMBNAIL_SIZE / 2)
				.attr("width", GLYPH_THUMBNAIL_SIZE)
				.attr("height", GLYPH_THUMBNAIL_SIZE);	
		});
	
	// Initialize zoom & pan handler
	zoomHandler = d3.behavior.zoom()
 		.x(xScale)
 		.y(yScale)
 		.scaleExtent([0.5, 5])
 		.on("zoom", onVisZoomed);
	
	svg.call(zoomHandler);
	
	resetPanZoomLevels();
	
	updateDisplayedEntries();
}

// Resets pan & zoom levels
function resetPanZoomLevels() {
	if (zoomHandler) {
		var svg = d3.select("#visSvg");
		
		zoomHandler.translate(DEFAULT_PAN)
		.scale(DEFAULT_ZOOM)
		.event(svg);
	}
}

// Generates the transformation attribute for visual items
function visItemTransform(d) {
	return "translate(" + xScale(d.x) + "," + yScale(d.y) + ")";
}

// Updates the coordinates for visualization items
function updateEntriesCoordinates() {
	d3.select("#visEntries").selectAll("g.content-entry")
		.data(layoutNodes)
		.attr("transform", visItemTransform);
}

// Handles the zoom / pan event for visualization
function onVisZoomed() {
	// Update the coordinates
	updateEntriesCoordinates();
	
	// Update selection effects
	updateEntrySelectionEffects();

	// Update highlighting effects
	updateEntryHoverEffects();
	
	// Check if the centering button should be displayed
	if (zoomHandler) {
		if (zoomHandler.scale() != DEFAULT_ZOOM
			|| !_.isEqual(zoomHandler.translate(), DEFAULT_PAN)) {
			$("#resetPanZoom").removeClass("hidden");
		}
	}
}

// Centers the visualization, and hides the centering button
function onCenterButtonClick() {
	resetPanZoomLevels();
		
	$("#resetPanZoom").addClass("hidden");
}


// Updates the visibility of the weights reset button
function updateResetWeightsButton(){
	var resetButton = $("#resetWeights");
	
	if (_.any(distanceWeights, function(d){return d < 1.0; }))
		resetButton.removeClass("hidden");
	else
		resetButton.addClass("hidden");
}

// Handles the weights reset button click
function onResetWeights(){
	var element = $(this);
	
	element.addClass("hidden");
	
	for (var k in distanceWeights) {
		distanceWeights[k] = 1.0;
	}
	$(".weight-slider").each(function(){
		$(this).val(1.0);
	})
	
	// Update the norm
	distanceWeightNorm = _.reduce(distanceWeights, function(acc, d){ return acc + d; }, 0);
			
	// Update the visualization
	onDistanceWeightsUpdate();
}


// Populates the summary table
function populateSummaryTable() {
	var container = $("#summaryTableContainer");
	container.empty();
	
	// Create the ordered list of categories
	var categoriesList = [];
	$.each(categoriesMap, function(i, d){
		if (d.type == "category-entry"
			&& !d.disabled)
			categoriesList.push(i);
	});
	categoriesList.sort(categoriesComparator);
	
	// Create the table
	var table = $("<table class=\"table table-bordered table-hover\"></table>");
		
	// Create the header row
	var tableHead = $("<thead></thead>");
	var headerRow = $("<tr></tr>");
	headerRow.append("<th>Technique</th>");
		
	$.each(categoriesList, function(i,d){
		var item = categoriesMap[d];
		
		var element = $("<span class=\"category-entry \""
			    + "data-tooltip=\"tooltip\"></span>");
		element.prop("title", item.descriptionPrefix
				? item.descriptionPrefix + item.description
				: item.description);
		element.append(item.content);
		
		var cell = $("<th class=\"category-cell\"></th>");
		cell.append(element);
		headerRow.append(cell);
	});
	tableHead.append(headerRow);
	table.append(tableHead);
	
	// Get the list of entries sorted by year in increasing order
	var entriesList = $.map(entriesMap, function(d){return d;});
	entriesList.sort(function(d1, d2){
		return d2.sortIndex - d1.sortIndex;
	});
		
	// Create the table body
	var tableBody = $("<tbody></tbody>");
	$.each(entriesList, function(i, d){
		var row = $("<tr></tr>");
		
		// Add the technique title
		row.append("<td class=\"technique-cell\">"
				+ "<a href=\"#\" data-id=\"" + d.id + "\" class=\"summary-entry-link\">"
				+ d.title + " (" + d.year + ")"
				+ "</a>" + "</td>");
		
		// Prepare the set of technique's categories for further lookup
		var hasCategory = {};
		for (var j = 0; j < d.categories.length; j++){
			hasCategory[d.categories[j]] = true;
		}
		
		// Iterate over the general list of categories and append row cells
		for (var j = 0; j < categoriesList.length; j++){
			var cell = $("<td class=\"category-cell\"></td>");
			
			if (hasCategory[categoriesList[j]]) {
				var item = categoriesMap[categoriesList[j]];
				
				cell.addClass("category-present");
				cell.attr("data-tooltip", "tooltip");
				cell.prop("title", item.descriptionPrefix
						? item.descriptionPrefix + item.description
						: item.description);
			}
			
			row.append(cell);
		}
		
		tableBody.append(row);
	});
		
	table.append(tableBody);
		
	// Insert the table into the modal
	container.append(table);
	
	// Setup the handler for links
	table.on("click", ".summary-entry-link", onSummaryEntryLinkClick);
}

// Handles the click on a summary entry link
function onSummaryEntryLinkClick(){
	// Close the summary dialog
	$("#summaryTableModal").modal("hide");
	
	// Emulate the effects of a closed details dialog
	onDetailsModalHidden();
		
	// Get the ID of the entry link
	var id = $(this).data("id");
	
	// Trigger the usual handler
	displayEntryDetails(id);
			
	// Return false to prevent the default handler for hyperlinks
	return false;
}

// Resets the new entry form
function onAddFormReset(){
	$("#addEntryModal form .form-group").removeClass("has-error").removeClass("has-success");
	$("#inputEntryCategories .category-entry.active").removeClass("active");
}


// Initializes category filters for the new entry form by copying HTML contents of the filters panel
function initializeFormCategories(){
	$("#inputEntryCategories").html($("#categoriesList").html());
	
	$("#inputEntryCategories button")
	.removeClass("active")
	.attr("data-toggle", "button");
}


// Validates the new entry form and creates a JSON entry file
function onAddEntry(){
	if (!validateEntryForm())
		return;
	
	// Create an object
	var entry = {};
	
	if ($("#inputEntryTitle").val())
		entry.title = $("#inputEntryTitle").val();
	
	if ($("#inputEntryYear").val())
		entry.year = $("#inputEntryYear").val();
		
	if ($("#inputEntryAuthors").val())
		entry.authors = $("#inputEntryAuthors").val();
	
	if ($("#inputEntryReference").val())
		entry.reference = $("#inputEntryReference").val();
	
	if ($("#inputEntryPMID").val())
		entry.pmid = $("#inputEntryPMID").val();
	
	if ($("#inputEntryUrl").val())
		entry.url = $("#inputEntryUrl").val();
	
	if ($("#inputEntryImplementationUrl").val())
		entry.implementation_url = $("#inputEntryImplementationUrl").val();
	
	entry.categories = [];
	$("#inputEntryCategories").find("button.active").each(function(){
		if ($(this).attr("data-entry"))
			entry.categories.push($(this).attr("data-entry"));
	});
	
	$("#addEntryModal").modal("hide");
	
	// Create a blob for downloading
	exportBlob(JSON.stringify(entry), "application/json");
}

// Validates the new entry form
function validateEntryForm(){
	var isValid = true;
	
	$("#addEntryModal form .form-group").each(function(){
		var element = $(this);
		
		if (element.find("input.form-control.form-mandatory").length){
			if (!element.find("input.form-control.form-mandatory").first().val()) {
				isValid = false;
				element.removeClass("has-success").addClass("has-error");
			} else {
				element.removeClass("has-error").addClass("has-success");
			}
		}
		
		if (element.find("#inputEntryCategories").length){
			if (!$("#inputEntryCategories").find("button.active").length) {
				isValid = false;
				element.removeClass("has-success").addClass("has-error");
			} else {
				element.removeClass("has-error").addClass("has-success");
			}
		}
			
	});
	
	return isValid;
}


// Exports the provided blob data
function exportBlob(blobData, type){
	var blob = new Blob([blobData], {"type":type});
	var link = window.URL.createObjectURL(blob);
	
	window.open(link, "_blank");
	 
	setTimeout(function(){
		window.URL.revokeObjectURL(link);
	}, 10000);
}


//Renders the statistics diagram
function onAboutModalShown(){
	$("#statsContainer").empty();
	
	var minWidth = 6;
	var totalCount = Object.keys(entriesMap).length;
	
	var color = d3.scale.ordinal()
	.range(colorbrewer.Dark2[5]);
	
	$("#statsContainer").append(
			"<div>Total number of techniques included: "
			+ "<span id=\"totalTechniquesCount\">"
			+ totalCount + "</span>" + "</div>");
	
	var trimToLength = function(string, length){
		var padding = "...";
		
		if (string.length <= length - padding.length)
			return string;
		else
			return string.substring(0, length - padding.length) + padding;
	};
	
	// It seems that the width values returned by the browser are not reliable,
	// so simply account for the nested level manually
	// XXX: the code calculating these width values is currently a terrible
	// black magic hack, but it works. It would be much better to simply
	// do it with SVG, but it would be tricky to use glyph symbols.
	
	var processCategory = function(category, container, nestedLevel){
		if (category.children)
			$.each(category.children, function(i, d){
				var currentContainer = container;
				
				if (d.children) {
					var newContainer = $("<div class=\"diagram-category-container\"></div>");
					newContainer.attr("data-category", d.title);
					container.append(newContainer);
					currentContainer = newContainer;
				}
				
				var row = $("<div class=\"diagram-row\"></div>");
				row.attr("title", d.description + ": " + d.value + " relevant techniques");
				row.attr("data-category", d.title);
				currentContainer.append(row);
				
				// Check if category title should be included
				if (d.children) {
					row.addClass("diagram-category-row");
					
					// Add a description into a separate div
					var divCategoryTitle = $("<div class=\"diagram-category-title\"></div>");
					divCategoryTitle.text(trimToLength(d.description, 40));
					row.append(divCategoryTitle);
				}
				
				// The actual row container for icon and bar
				var rowContent = $("<div class=\"diagram-row-content\"></div>");
				row.append(rowContent);
				
				// Check if category title should be included
				var barTitle = $("<span class=\"bar-title\"></span>");
				if (d.children) {
					// Use the element as a placeholder with fixed width
					barTitle.addClass("bar-icon-placeholder");	
				} else {
					// Use the element as an icon
					barTitle.addClass("bar-icon");
					barTitle.append(categoriesMap[d.title].content);
				}
				rowContent.append(barTitle);
				
				var outerContainerWidth = Math.floor(parseFloat($("#statsContainer").innerWidth()));
				var maxWidth = outerContainerWidth
					- Math.ceil(parseFloat(barTitle.css("width"))) - Math.ceil(parseFloat(barTitle.css("margin-right")));
				if (d.children) {
					maxWidth -= 10 * (nestedLevel + 2);
				} else {
					maxWidth -= 10 * nestedLevel;
				}
												
				var width = Math.floor(minWidth + (maxWidth - minWidth) * (d.value * 1.0 / totalCount));
								
				var bar = $("<div class=\"diagram-bar\"></div>");
				rowContent.append(bar);
				
				bar.css("width",  width + "px");
				bar.css("background", color(d.topCategory));
					
				var barValue = $("<span class=\"bar-value\"></span>");
				barValue.text(d.value);
				bar.append(barValue);	
				
				processCategory(d, currentContainer, nestedLevel + 2);
			});
		
	};
	
	processCategory(stats, $("#statsContainer"), 2);
}
