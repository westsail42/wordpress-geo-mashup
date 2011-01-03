/**
 * Google API implementation for Geo Mashup maps.
 *
 * @package GeoMashup
 * @subpackage Client
 */

/*global GeoMashup */
/*global customizeGeoMashup, customizeGeoMashupMap, customGeoMashupColorIcon, customGeoMashupCategoryIcon */
/*glboal customGeoMashupSinglePostIcon, customGeoMashupMultiplePostImage */
/*global mxn */

GeoMashup.createCategoryLine = function ( category ) {
	category.line = new google.maps.Polyline(category.points, category.color);
	google.maps.Event.addListener( category.line, 'click', function () {
		GeoMashup.map.zoomIn();
	} );
	this.doAction( 'categoryLine', this.opts, category.line );
	this.map.addOverlay(category.line);
	if (this.map.getZoom() > category.max_line_zoom) {
		category.line.hide();
	}
};

GeoMashup.openMarkerInfoWindow = function( marker, content_node, window_opts ) {
	var latlng = marker.getLatLng();
	this.doAction( 'markerInfoWindowOptions', this.opts, this.locations[latlng], window_opts );
	this.locations[latlng].info_window_options = window_opts;
	this.locations[latlng].loaded = true;
	marker.openInfoWindow( content_node, window_opts );
};

GeoMashup.loadMaxContent = function( marker, regular_node, info_window_max_url ) {
	var info_window_max_request = new google.maps.XmlHttp.create();
	info_window_max_request.open( 'GET', info_window_max_url, true );
	info_window_max_request.onreadystatechange = function() {
		var max_node, max_options;
		if (info_window_max_request.readyState === 4 && info_window_max_request.status === 200 ) {
			max_node = document.createElement( 'div' );
			max_node.innerHTML = info_window_max_request.responseText;
			GeoMashup.parentizeLinks( max_node );
			GeoMashup.openMarkerInfoWindow( marker, regular_node, {maxContent : max_node} );
		} // end max readState === 4
	}; // end max onreadystatechange function
	info_window_max_request.send( null );
};

GeoMashup.openInfoWindow = function( marker ) {
	var object_ids, i, url, info_window_request, object_element, point = marker.getPoint();

	this.map.closeInfoWindow();
		
	if (this.locations[point].loaded) {
		marker.openInfoWindow( this.locations[point].info_node, this.locations[point].info_window_options );
	} else {
		marker.openInfoWindowHtml('<div align="center"><img src="' +
			this.opts.url_path + 
			'/images/busy_icon.gif" alt="Loading..." /></div>');
		object_ids = '';
		for(i=0; i<this.locations[point].objects.length; i += 1) {
			if (i>0) {
				object_ids += ',';
			}
			object_ids += this.locations[point].objects[i].object_id;
		}
		url = this.geo_query_url + '&object_name=' + this.opts.object_name +
			'&object_ids=' + object_ids;
		info_window_request = new google.maps.XmlHttp.create();
		info_window_request.open('GET', url, true);
		info_window_request.onreadystatechange = function() {
			var node, info_window_max_request, info_window_max_url;

			if (info_window_request.readyState === 4 && info_window_request.status === 200) {
				node = document.createElement('div');
				node.innerHTML = info_window_request.responseText;
				GeoMashup.parentizeLinks( node );
				GeoMashup.locations[point].info_node = node;
				if ( 'post' == GeoMashup.opts.object_name ) {
					GeoMashup.loadMaxContent( marker, node, url + '&template=info-window-max' );
				} else {
					GeoMashup.openMarkerInfoWindow( marker, node, {} );
				}
			} // end readystate === 4
		}; // end onreadystatechange function
		info_window_request.send(null);
	} // end object not loaded yet 
};

GeoMashup.addGlowMarker = function( marker ) {
	var glow_icon;

	if ( this.glow_marker ) {
		this.map.removeOverlay( this.glow_marker );
		this.glow_marker.setLatLng( marker.getLatLng() );
	} else {
		glow_icon = new google.maps.Icon( {
			image : this.opts.url_path + '/images/mm_20_glow.png',
			iconSize : new google.maps.Size( 22, 30 ),
			iconAnchor : new google.maps.Point( 11, 27 ) 
		} );
		this.doAction( 'glowMarkerIcon', this.opts, glow_icon );
		this.glow_marker = new google.maps.Marker( marker.getLatLng(), {
			clickable : false,
			icon : glow_icon
		} );
	}
	this.map.addOverlay( this.glow_marker );
};

GeoMashup.removeGlowMarker = function() {
	this.map.removeOverlay( this.glow_marker );
};

GeoMashup.hideAttachments = function() {
	var i, j, obj;

	for ( i = 0; i < this.open_attachments.length; i += 1 ) {
		this.map.removeOverlay( this.open_attachments[i] );
	} 
	this.open_attachments = [];
};

GeoMashup.showMarkerAttachments = function( marker ) {
	var i, j, objects, obj;

	this.hideAttachments();
	objects = this.getObjectsAtLocation( marker.getLatLng() );
	for ( i = 0; i < objects.length; i += 1 ) {
		obj = objects[i];
		if ( obj.attachments ) {
			// Attachment overlays are available
			for ( j = 0; j < obj.attachments.length; j += 1 ) {
				this.open_attachments.push( obj.attachments[j] );
				this.map.addOverlay( obj.attachments[j] );
			}
		} else if ( obj.attachment_urls && obj.attachment_urls.length > 0 ) {
			// There are attachments to load
			obj.attachments = [];
			for ( j = 0; j < obj.attachment_urls.length; j += 1 ) {
				obj.attachments[j] = new google.maps.GeoXml( obj.attachment_urls[j] );
				this.open_attachments.push( obj.attachments[j] );
				this.map.addOverlay( obj.attachments[j] );
			}
		}
	}
};

GeoMashup.loadFullPost = function( point ) {
	var i, url, post_request, object_ids;

	this.getShowPostElement().innerHTML = '<div align="center"><img src="' +
		this.opts.url_path + '/images/busy_icon.gif" alt="Loading..." /></div>';
	object_ids = [];
	for(i=0; i<this.locations[point].objects.length; i += 1) {
		object_ids.push( this.locations[point].objects[i].object_id );
	}
	url = this.geo_query_url + '&object_name=' + this.opts.object_name +
		'&object_ids=' + object_ids.join( ',' ) + '&template=full-post';
	post_request = new google.maps.XmlHttp.create();
	post_request.open('GET', url, true);
	post_request.onreadystatechange = function() {
		if (post_request.readyState === 4 && post_request.status === 200) {
			GeoMashup.getShowPostElement().innerHTML = post_request.responseText;
			GeoMashup.locations[point].post_html = post_request.responseText;
		} // end readystate === 4
	}; // end onreadystatechange function
	post_request.send(null);
};

GeoMashup.addObjectIcon = function( obj ) {
	if (typeof customGeoMashupCategoryIcon === 'function') {
		obj.icon = customGeoMashupCategoryIcon(this.opts, obj.categories);
	} 
	if (!obj.icon) {
		if (obj.categories.length > 1) {
			obj.icon = new google.maps.Icon(this.multiple_category_icon);
		} else if (obj.categories.length === 1) {
			obj.icon = new google.maps.Icon(this.categories[obj.categories[0]].icon);
		} else {
			obj.icon = new google.maps.Icon(this.base_color_icon);
			obj.icon.image = this.opts.url_path + '/images/mm_20_red.png';
		} 
		this.doAction( 'objectIcon', this.opts, obj );
	}
};

GeoMashup.createMarker = function( point, obj ) {
	var marker, 
		// Apersand entities have been added for validity, but look bad in titles
		marker_opts = {title: obj.title.replace( '&amp;', '&' )};

	if ( !obj.icon ) {
		this.addObjectIcon( obj );
	}
	marker_opts.icon = obj.icon;
	this.doAction( 'objectMarkerOptions', this.opts, marker_opts, obj );
	marker = new google.maps.Marker(point,marker_opts);

	google.maps.Event.addListener(marker, 'click', function() {
		GeoMashup.selectMarker( marker );
	}); 

	google.maps.Event.addListener( marker, 'remove', function() {
		if ( GeoMashup.selected_marker && marker === GeoMashup.selected_marker ) {
			GeoMashup.deselectMarker();
		}
	} );

	google.maps.Event.addListener( marker, 'visibilitychanged', function( is_visible ) {
		if ( GeoMashup.selected_marker && marker === GeoMashup.selected_marker && !is_visible ) {
			GeoMashup.deselectMarker();
		}
	} );

	this.doAction( 'marker', this.opts, marker );

	return marker;
};

GeoMashup.checkDependencies = function () {
	if (typeof google.maps.Map === 'undefined' || !google.maps.BrowserIsCompatible()) {
		this.container.innerHTML = '<p class="errormessage">' +
			'Sorry, the Google Maps script failed to load. Have you entered your ' +
			'<a href="http://maps.google.com/apis/maps/signup.html">API key<\/a> ' +
			'in the Geo Mashup Options?';
		throw "The Google Maps javascript didn't load.";
	}
};

GeoMashup.clickObjectMarker = function(object_id, try_count) {
	if (typeof try_count === 'undefined') {
		try_count = 1;
	}
	if (this.objects[object_id] && try_count < 4) {
		if (GeoMashup.objects[object_id].marker.isHidden()) {
			try_count += 1;
			setTimeout(function () {GeoMashup.clickObjectMarker(object_id, try_count);}, 300);
		} else {
			google.maps.Event.trigger(GeoMashup.objects[object_id].marker,"click"); 
		}
	}
};

GeoMashup.colorIcon = function( color_name ) {
	var icon = new google.maps.Icon(this.base_color_icon);
	icon.image = this.opts.url_path + '/images/mm_20_' + color_name + '.png';
	return icon;
};

GeoMashup.getMarkerLatLng = function( marker ) {
	return marker.getLatLng();
}

GeoMashup.hideMarker = function( marker ) {
	marker.hide();
};

GeoMashup.showMarker = function( marker ) {
	marker.show();
};

GeoMashup.hideLine = function( line ) {
	line.hide();
};

GeoMashup.showLine = function( line ) {
	line.show();
};

GeoMashup.newLatLng = function( lat, lng ) {
	return new google.maps.LatLng( lat, lng );
};

GeoMashup.extendLocationBounds = function( latlng ) {
	this.location_bounds.extend( latlng );
};

GeoMashup.addMarkers = function( markers ) {
	if ( ( ! this.clusterer ) || 'clustermarker' === this.opts.cluster_lib ) {
		// No clustering, or ClusterMarker need the markers added to the map 
		this.forEach( markers, function( i, marker ) {
			this.map.addOverlay( marker );
		} );
	}
	if ( this.clusterer && markers.length > 0 ) {
		this.clusterer.addMarkers( markers );
		this.recluster();
	}
};

GeoMashup.makeMarkerMultiple = function( marker ) {
	var plus_image;
	if (typeof customGeoMashupMultiplePostImage === 'function') {
		plus_image = customGeoMashupMultiplePostImage(this.opts, marker.getIcon().image);
	}
	if (!plus_image) {
		plus_image = this.opts.url_path + '/images/mm_20_plus.png';
	}
	marker.setImage( plus_image );
	// marker.setImage doesn't survive clustering - still true?
	marker.getIcon().image = plus_image;
	this.doAction( 'multiObjectMarker', this.opts, marker );
	this.doAction( 'multiObjectIcon', this.opts, marker.getIcon() );
};

GeoMashup.setCenterUpToMaxZoom = function( latlng, zoom, callback ) {
		var map_type = this.map.getCurrentMapType();
		if ( map_type == google.maps.SATELLITE_MAP || map_type == google.maps.HYBRID_MAP ) {
			map_type.getMaxZoomAtLatLng( latlng, function( response ) {
				if ( response && response['status'] === google.maps.GEO_SUCCESS ) {
					if ( response['zoom'] < zoom ) {
						zoom = response['zoom'];
					}
				}
				GeoMashup.map.setCenter( latlng, zoom );
				if ( typeof callback === 'function' ) {
					callback( zoom );
				}
			}, zoom );
		} else {
			// Current map type doesn't have getMaxZoomAtLatLng
			if ( map_type.getMaximumResolution() < zoom ) {
				zoom = map_type.getMaximumResolution();
			}
			this.map.setCenter( latlng, zoom );
			if ( typeof callback === 'function' ) {
				callback( zoom );
			}
		}
	},

GeoMashup.autoZoom = function() {
	var zoom = this.map.getBoundsZoomLevel( this.location_bounds );
	var max_zoom = parseInt( this.opts.auto_zoom_max, 10 );
	if ( zoom > max_zoom ) {
		zoom = max_zoom;
	}
	this.setCenterUpToMaxZoom( 
		this.location_bounds.getCenter(), 
		zoom,
		function() {GeoMashup.updateVisibleList();} 
	);
};

GeoMashup.centerMarker = function( marker, zoom ) {
	if ( typeof zoom === 'number' ) {
		this.map.setCenter( marker.getLatLng(), zoom );
	} else {
		this.map.panTo( marker.getLatLng() );
	}
};

GeoMashup.requestObjects = function( use_bounds ) {
	var request, url, map_bounds, map_span;
	if (this.opts.max_posts && this.object_count >= this.opts.max_posts) {
		return;
	}
	request = google.maps.XmlHttp.create();
	url = this.geo_query_url;
	if (use_bounds) {
		map_bounds = this.map.getBounds();
		map_span = map_bounds.toSpan();
		url += '&minlat=' + (map_bounds.getSouthWest().lat() - map_span.lat()) + 
			'&minlon=' + (map_bounds.getSouthWest().lng() - map_span.lng()) + 
			'&maxlat=' + (map_bounds.getSouthWest().lat() + 3*map_span.lat()) + 
			'&maxlon=' + (map_bounds.getSouthWest().lng() + 3*map_span.lat());
	}
	if (this.opts.map_cat) {
		url += '&cat=' + GeoMashup.opts.map_cat;
	}
	if (this.opts.max_posts) {
		url += '&limit=' + GeoMashup.opts.max_posts;
	}
	request.open("GET", url, true);
	request.onreadystatechange = function() {
		var objects;

		if (request.readyState === 4 && request.status === 200) {
			objects = window['eval']( '(' + request.responseText + ')' );
			GeoMashup.addObjects(objects,!use_bounds);
		} // end readystate === 4
	}; // end onreadystatechange function
	request.send(null);
};

GeoMashup.isMarkerVisible = function( marker ) {
	var map_bounds = this.map.getBounds();
	return ( ! marker.isHidden() && map_bounds.containsLatLng( marker.getLatLng() ) );
};

GeoMashup.recluster = function( ) {
	if (this.clusterer) { 
		if ( 'clustermarker' == this.opts.cluster_lib ) {
			this.clusterer.refresh();
		} else {
			this.clusterer.resetViewport();
		}
	}
};

GeoMashup.createMap = function(container, opts) {
	var i, type_num, center_latlng, map_opts, map_types, request, url, objects, point, marker_opts, 
		clusterer_opts, google_bar_opts, single_marker, ov, credit_div, initial_zoom = 1;

	this.container = container;
	this.checkDependencies();
	this.base_color_icon = new google.maps.Icon();
	this.base_color_icon.image = opts.url_path + '/images/mm_20_black.png';
	this.base_color_icon.shadow = opts.url_path + '/images/mm_20_shadow.png';
	this.base_color_icon.iconSize = new google.maps.Size(12, 20);
	this.base_color_icon.shadowSize = new google.maps.Size(22, 20);
	this.base_color_icon.iconAnchor = new google.maps.Point(6, 20);
	this.base_color_icon.infoWindowAnchor = new google.maps.Point(5, 1);
	this.multiple_category_icon = new google.maps.Icon(this.base_color_icon);
	this.multiple_category_icon.image = opts.url_path + '/images/mm_20_mixed.png';

	// Falsify options to make tests simpler
	this.forEach( opts, function( key, value ) {
		if ( 'false' === value || 'FALSE' === value ) {
			opts[key] = false;
		}
	} );

	// For now, the map name is always the iframe name
	opts.name = window.name;

	// For now, siteurl is the home url
	opts.home_url = opts.siteurl;

	map_types = {
		'G_NORMAL_MAP' : google.maps.NORMAL_MAP,
		'G_SATELLITE_MAP' : google.maps.SATELLITE_MAP,
		'G_HYBRID_MAP' : google.maps.HYBRID_MAP,
		'G_PHYSICAL_MAP' : google.maps.PHYSICAL_MAP,
		'G_SATELLITE_3D_MAP' : google.maps.SATELLITE_3D_MAP
	};

	if (typeof opts.map_type === 'string') {
		if ( map_types[opts.map_type] ) {
			opts.map_type = map_types[opts.map_type] ;
		} else {
			type_num = parseInt(opts.map_type, 10);
			if (isNaN(type_num)) {
				opts.map_type = google.maps.NORMAL_MAP;
			} else {
				opts.map_type = this.map.getMapTypes()[type_num];
			}
		}
	} else if (typeof opts.map_type === 'undefined') {
		opts.map_type = google.maps.NORMAL_MAP;
	}
	map_opts = {
		backgroundColor : '#' + opts.background_color,
		mapTypes : [ opts.map_type ],
		googleBarOptions : { 
			adsOptions : {client : ( opts.adsense_code ) ? opts.adsense_code : 'pub-5088093001880917'}	
		}
	};
	this.doAction( 'mapOptions', opts, map_opts );
	this.map = new google.maps.Map2( this.container, map_opts );
	this.map.setCenter(new google.maps.LatLng(0,0), 0);

	this.doAction( 'newMap', opts, this.map );

	// Create the loading spinner icon and show it
	this.spinner_div = document.createElement( 'div' );
	this.spinner_div.innerHTML = '<div id="gm-loading-icon" style="-moz-user-select: none; z-index: 100; position: absolute; left: ' +
		( this.map.getSize().width / 2 ) + 'px; top: ' + ( this.map.getSize().height / 2 ) + 'px;">' +
		'<img style="border: 0px none ; margin: 0px; padding: 0px; width: 16px; height: 16px; -moz-user-select: none;" src="' +
		opts.url_path + '/images/busy_icon.gif"/></a></div>';
	this.showLoadingIcon();
	google.maps.Event.bind( this.map, 'tilesloaded', this, this.hideLoadingIcon );

	if (!opts.object_name) {
		opts.object_name = 'post';
	}
	this.opts = opts;
	this.geo_query_url = opts.siteurl + '?geo_mashup_content=geo-query';
	if ( opts.hasOwnProperty( 'lang' ) ) {
		this.geo_query_url += '&lang=' + opts.lang;
	}

	google.maps.Event.bind(this.map, "zoomend", this, this.adjustZoom);
	google.maps.Event.bind(this.map, "moveend", this, this.adjustViewport);

	if (opts.cluster_max_zoom) {
		if ( 'clustermarker' === opts.cluster_lib ) {
			clusterer_opts = { 
				'iconOptions' : {},
				'fitMapMaxZoom' : opts.cluster_max_zoom,
				'clusterMarkerTitle' : '%count',
				'intersectPadding' : 3	
			};
			this.doAction( 'clusterOptions', this.opts, clusterer_opts );
			this.clusterer = new ClusterMarker( this.map, clusterer_opts );
		} else {
			clusterer_opts = {maxZoom: parseInt( opts.cluster_max_zoom )};
			this.doAction( 'clusterOptions', this.opts, clusterer_opts );
			this.clusterer = new MarkerClusterer( this.map, [], clusterer_opts );
		}
	}

	if ( opts.zoom !== 'auto' && typeof opts.zoom === 'string' ) {
		initial_zoom = parseInt(opts.zoom, 10);
	} else {
		initial_zoom = opts.zoom;
	}

	if (opts.load_kml) {
		this.kml = new google.maps.GeoXml(opts.load_kml);
		this.map.addOverlay(this.kml);
		if ( initial_zoom === 'auto' ) {
			this.kml.gotoDefaultViewport( this.map );
		}
	}

	this.buildCategoryHierarchy();

	if ( initial_zoom === 'auto' ) {
		// Wait to center and zoom after loading
	} else if (opts.center_lat && opts.center_lng) {
		// Use the center from options
		this.map.setCenter(new google.maps.LatLng(opts.center_lat, opts.center_lng), initial_zoom, opts.map_type);
	} else if (this.kml) {
		this.map.setCenter(this.kml.getDefaultCenter, initial_zoom, opts.map_type);
	} else if (opts.object_data && opts.object_data.objects[0]) {
		center_latlng = new google.maps.LatLng(opts.object_data.objects[0].lat, opts.object_data.objects[0].lng);
		this.map.setCenter(center_latlng, initial_zoom, opts.map_type);
	} else {
		// Center on the most recent located object
		request = google.maps.XmlHttp.create();
		url = this.geo_query_url + '&limit=1';
		if (opts.map_cat) {
			url += '&cat='+opts.map_cat;
		}
		request.open("GET", url, false);
		request.send(null);
		objects = window['eval']( '(' + request.responseText + ')' );
		if (objects.length>0) {
			point = new google.maps.LatLng(objects[0].lat,objects[0].lng);
			this.map.setCenter(point,initial_zoom,opts.map_type);
		} else {
			this.map.setCenter(new google.maps.LatLng(0,0),initial_zoom,opts.map_type);
		}
	}

	this.location_bounds = new google.maps.LatLngBounds();

	if (opts.map_content === 'single')
	{
		if (opts.center_lat && opts.center_lng && !this.kml)
		{
			marker_opts = {};
			if (typeof customGeoMashupSinglePostIcon === 'function') {
				marker_opts.icon = customGeoMashupSinglePostIcon(this.opts);
			}
			if ( !marker_opts.icon ) {
				marker_opts.icon = G_DEFAULT_ICON;
			}
			this.doAction( 'singleMarkerOptions', this.opts, marker_opts );
			single_marker = new google.maps.Marker(
				new google.maps.LatLng( this.opts.center_lat, this.opts.center_lng ), marker_opts );
			this.map.addOverlay( single_marker );
			this.doAction( 'singleMarker', this.opts, single_marker );
		}
	} else if (opts.object_data) {
		this.addObjects(opts.object_data.objects,true);
	} else {
		// Request objects near visible range first
		this.requestObjects(true);

		// Request all objects
		this.requestObjects(false);
	}

	if ('GSmallZoomControl' === opts.map_control) {
		this.map.addControl(new google.maps.SmallZoomControl());
	} else if ('GSmallZoomControl3D' === opts.map_control) {
		this.map.addControl(new google.maps.SmallZoomControl3D());
	} else if ('GSmallMapControl' === opts.map_control) {
		this.map.addControl(new google.maps.SmallMapControl());
	} else if ('GLargeMapControl' === opts.map_control) {
		this.map.addControl(new google.maps.LargeMapControl());
	} else if ('GLargeMapControl3D' === opts.map_control) {
		this.map.addControl(new google.maps.LargeMapControl3D());
	}

	if (opts.add_map_type_control ) {
		if ( typeof opts.add_map_type_control === 'string' ) {
			opts.add_map_type_control = opts.add_map_type_control.split(/\s*,\s*/);
			if ( typeof map_types[opts.add_map_type_control[0]] == 'undefined' ) {
				// Convert the old boolean value to a default array
				opts.add_map_type_control = [ 'G_NORMAL_MAP', 'G_SATELLITE_MAP', 'G_PHYSICAL_MAP' ];
			}
		}
		for ( i = 0; i < opts.add_map_type_control.length; i += 1 ) {
			this.map.addMapType( map_types[opts.add_map_type_control[i]] );
		}
		this.map.addControl(new google.maps.MapTypeControl());
	}

	if (opts.add_overview_control) {
		this.overview_control = new google.maps.OverviewMapControl();
		this.overview_control.setMapType( opts.map_type );
		this.doAction( 'overviewControl', this.opts, this.overview_control );
		this.map.addControl( this.overview_control );
		ov = document.getElementById('gm-overview');
		if (ov) {
			ov.style.position = 'absolute';
			this.container.appendChild(ov);
		}
	}

	if ( opts.add_google_bar ) {
		this.map.enableGoogleBar();
	}

	if ( opts.enable_scroll_wheel_zoom ) {
		this.map.enableScrollWheelZoom();
	}

	google.maps.Event.addListener( this.map, 'click', function( overlay ) {
		if ( GeoMashup.selected_marker && overlay !== GeoMashup.selected_marker && overlay !== GeoMashup.map.getInfoWindow() ) {
			GeoMashup.deselectMarker();
		}
	} );

	if (typeof customizeGeoMashupMap === 'function') {
		customizeGeoMashupMap(this.opts, this.map);
	}
	if (typeof customizeGeoMashup === 'function') {
		customizeGeoMashup(this);
	}
	this.doAction( 'loadedMap', this.opts, this.map );

};
