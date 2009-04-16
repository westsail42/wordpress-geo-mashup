<?php
/** 
 * Geo Mashup "core" implementation of location management user interfaces.
 *
 * Theoretically, everything done here could be done in a separate plugin.
 *
 * @package GeoMashup
 */

/**
 * A pattern for managing user interfaces for collecting and storing location.
 *
 * This is an abstract class with a little code common to Geo Mashup form managers.
 * It isn't necessary to extend this class to manage a location, i.e. this is 
 * an implementation, not an API.
 *
 * @since 1.3beta1
 */
class GeoMashupUIManager {
	
	function enqueue_form_client_items() {	
		wp_enqueue_style( 'geo-mashup-edit-form', GEO_MASHUP_URL_PATH . '/edit-form.css', false, '1.0.0', 'screen' );

		wp_enqueue_script( 'google-jsapi' );
		wp_enqueue_script( 'geo-mashup-admin', 
			GEO_MASHUP_URL_PATH . '/geo-mashup-admin.js', 
			array( 'jquery', 'google-jsapi' ), 
			GEO_MASHUP_VERSION );
	}

	function save_posted_object_location( $object_name, $object_id ) {
		if ( empty( $_POST['geo_mashup_edit_nonce'] ) || !wp_verify_nonce( $_POST['geo_mashup_edit_nonce'], 'geo-mashup-edit-post' ) ) {
			return $object_id;
		}
		if ( isset( $_POST['geo_mashup_changed'] ) && $_POST['geo_mashup_changed'] == 'true' ) {
			if ( empty( $_POST['geo_mashup_location'] ) ) {
				GeoMashupDB::delete_object_location( $object_name, $object_id );
			} else if ( !empty( $_POST['geo_mashup_location_id'] ) ) {
				GeoMashupDB::set_object_location( $object_name, $object_id, $_POST['geo_mashup_location_id'] );
			} else {
				list( $lat, $lng ) = split( ',', $_POST['geo_mashup_location'] );
				$post_location = array( );
				$post_location['lat'] = trim( $lat );
				$post_location['lng'] = trim( $lng );
				$post_location['saved_name'] = $_POST['geo_mashup_location_name'];
				$post_location['geoname'] = $_POST['geo_mashup_geoname'];
				$post_location['address'] = $_POST['geo_mashup_address'];
				$post_location['postal_code'] = $_POST['geo_mashup_postal_code'];
				$post_location['country_code'] = $_POST['geo_mashup_country_code'];
				$post_location['admin_code'] = $_POST['geo_mashup_admin_code'];
				$post_location['sub_admin_code'] = $_POST['geo_mashup_sub_admin_code'];
				$post_location['locality_name'] = $_POST['geo_mashup_locality_name'];
				GeoMashupDB::set_object_location( $object_name, $object_id, $post_location );
			}
		}
		return $object_id;
	}
}

/**
 * A manager for user location user interfaces.
 *
 * Singleton instantiated immediately.
 *
 * @package GeoMashup
 * @since 1.3beta1
 */
class GeoMashupUserUIManager extends GeoMashupUIManager {
	/**
	 * PHP4 Constructor
	 */
	function GeoMashupUserUIManager() {
		// Global $geo_mashup_options is available, but a better pattern might
		// be to wait until init to be sure
		add_action( 'init', array( $this, 'init' ) );
	}

	function init() {
		global $geo_mashup_options;

		// Enable this interface when the option is set and we're on a destination page
		$enabled = $geo_mashup_options->get( 'overall', 'located_object_name', 'user' ) == 'true' &&
			preg_match( '/(user-edit|profile).php/', $_SERVER['REQUEST_URI'] );

		// If enabled, queue up all the interface elements
		if ( $enabled ) { 

			// Form generation
			add_action( 'show_user_profile', array( $this, 'print_form' ) );
			add_action( 'edit_user_profile', array( $this, 'print_form' ) );

			// Form processing
			add_action( 'personal_options_update', array( $this, 'save_user'));
			add_action( 'edit_user_profile_update', array( $this, 'save_user'));

			$this->enqueue_form_client_items();
		}
	}

	function print_form()
	{
		global $user_id;

		include_once( GEO_MASHUP_DIR_PATH . '/edit-form.php');
		if ( isset( $_GET['user_id'] ) ) {
			$object_id = $_GET['user_id'];
		} else {
			$object_id = $user_id;
		}
		echo '<h3>' . __( 'Location', 'GeoMashup' ) . '</h3>';
		geo_mashup_edit_form( 'user', $user_id );
	}

	function save_user() {
		if ( empty( $_POST['user_id'] ) ) {
			return false;
		}

		$user_id = $_POST['user_id'];

		if ( !is_numeric( $user_id ) ) {
			return $user_id;
		}

		if ( !current_user_can( 'edit_user', $user_id ) ) {
			return $user_id;
		}

		return $this->save_posted_object_location( 'user', $user_id );
	}
}

// Single instance
new GeoMashupUserUIManager();

/**
 * A manager for post/page location user interfaces.
 *
 * Singleton instantiated immediately.
 *
 * @package GeoMashup
 * @since 1.3beta1
 */
class GeoMashupPostUIManager extends GeoMashupUIManager {
	var $inline_location;

	/**
	 * PHP4 Constructor
	 */
	function GeoMashupPostUIManager() {
		// Global $geo_mashup_options is available, but a better pattern might
		// be to wait until init to be sure
		add_action( 'init', array( $this, 'init' ) );
	}

	function init() {
		global $geo_mashup_options;

		// Enable this interface when the option is set 
		$enabled = $geo_mashup_options->get( 'overall', 'located_object_name', 'post' ) == 'true';

		if ( $enabled ) { 
			// Queue inline location handlers

			// Pre-save filter checks saved content for inline location tags
			add_filter( 'content_save_pre', array( $this, 'content_save_pre') );

			// Save post handles both inline and form processing
			add_action( 'save_post', array( $this, 'save_post'), 10, 2 );

			// If we're on a post editing page, queue up the form interface elements
			if ( preg_match( '/(post|page)(-new|).php/', $_SERVER['REQUEST_URI'] ) ) {

				// Form generation
				add_action( 'admin_menu', array( $this, 'admin_menu' ) );

				// Uploadable geo content type expansion
				add_filter( 'upload_mimes', array( $this, 'upload_mimes' ) );

				// Flash upload display
				add_filter( 'media_meta', array( $this, 'media_meta' ), 10, 2 );

				// Browser upload processing
				add_filter( 'wp_handle_upload', array( $this, 'wp_handle_upload' ) );

				// Browser upload display
				add_action( 'admin_print_scripts', array( $this, 'admin_print_scripts' ) );

				$this->enqueue_form_client_items();
			}
		}
	}

	function admin_menu() {
		// Not adding a menu, but at this stage add_meta_box is defined, so we can add the location form
		add_meta_box( 'geo_mashup_post_edit', __( 'Location', 'GeoMashup' ), array( $this, 'print_form' ), 'post', 'advanced' );
		add_meta_box( 'geo_mashup_post_edit', __( 'Location', 'GeoMashup' ), array( $this, 'print_form' ), 'page', 'advanced' );
	}

	function print_form() {
		global $post_ID;

		include_once( GEO_MASHUP_DIR_PATH . '/edit-form.php');
		geo_mashup_edit_form( 'post', $post_ID );
	}

	function save_post($post_id, $post) {
		if ($post->post_type == 'revision') {
			return;
		}

		// Inline locations circumvent the form checks, since they originate elsewhere
		// TODO: Relying a bit on WP for validation here, examine
		if ( !empty( $this->inline_location ) ) {
			GeoMashupDB::set_object_location( 'post', $post_id, $inline_location );
			$this->inline_location = null;
		}

		if ( 'page' == $_POST['post_type'] ) {
			if ( !current_user_can( 'edit_page', $post_id ) ) return $post_id;
		} else {
			if ( !current_user_can( 'edit_post', $post_id ) ) return $post_id;
		}

		update_option('geo_mashup_temp_kml_url','');

		return $this->save_posted_object_location( 'post', $post_id );
	}

	function content_save_pre( $content ) {
		// Piggyback on the shortcode interface to find inline tags [geo_mashup_save_location ...] 
		add_shortcode( 'geo_mashup_save_location', 'is_null' );
		$pattern = get_shortcode_regex( );
		return preg_replace_callback('/'.$pattern.'/s', array( $this, 'replace_save_pre_shortcode' ), $content);
	}

	function replace_save_pre_shortcode( $shortcode_match ) {
		if ( $shortcode_match[1] == 'geo_mashup_save_location' ) {
			// There is an inline location - save the attributes
			$this->inline_location = shortcode_parse_atts( stripslashes( $shortcode_match[2] ) );
			// Remove the tag
			$content = '';
		} else {
			// Whatever was matched, leave it be
			$content = $shortcode_match[0];
		}
		return $content;
	}

	function media_meta( $content, $post ) {
		// Only chance to run some javascript after a flash upload?
		if (strpos($_SERVER['REQUEST_URI'], 'async-upload.php') > 0 && strlen($post->guid) > 0) {
			$content .= '<script type="text/javascript"> ' .
				'if (parent.GeoMashupAdmin) parent.GeoMashupAdmin.loadKml(\''.$post->guid.'\');' .
				'</script>';
		}
		return $content;
	}

	function admin_print_scripts( $not_used ) {
		// Load any uploaded KML into the search map - only works with browser uploader
		if ( strpos( $_SERVER['REQUEST_URI'], 'upload.php' ) > 0 ) {
			// See if wp_upload_handler found uploaded KML
			$kml_url = get_option( 'geo_mashup_temp_kml_url' );
			if (strlen($kml_url) > 0) {
				// Load the KML in the location editor
				echo '
					<script type="text/javascript"> 
						if (parent.GeoMashupAdmin) parent.GeoMashupAdmin.loadKml(\'' . $kml_url . '\');
					</script>';
				update_option( 'geo_mashup_temp_kml_url', '' );
			}
		}
	}

	function upload_mimes( $mimes ) {
		$mimes['kml'] = 'application/vnd.google-earth.kml+xml';
		return $mimes;
	}

	function wp_handle_upload( $args ) {
		// If an upload is KML, put the URL in an option to be loaded in the response
		update_option( 'geo_mashup_temp_kml_url', '' );
		if ( is_array( $args ) && isset( $args['file'] ) ) {
			if ( stripos( $args['file'], '.kml' ) == strlen( $args['file'] ) - 4 ) {
				update_option( 'geo_mashup_temp_kml_url', $args['url'] );
			}
		}
		return $args;
	}
}

// Single instance
new GeoMashupPostUIManager();
?>
