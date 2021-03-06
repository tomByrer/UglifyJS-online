/*global defaults:false, parse:false, Compressor:false, JS_Parse_Error:false, DefaultsError:false */
/*jshint globalstrict:true */

'use strict';

// Create a simple wrapper around UglifyJS

var default_options = {};
function uglify(code, options) {
	// Create copies of the options
	var parse_options = defaults({}, options.parse);
	var compress_options = defaults({}, options.compress);
	var output_options = defaults({}, options.output);

	parse_options = defaults(parse_options, default_options.parse, true);
	compress_options = defaults(compress_options, default_options.compress, true);
	output_options = defaults(output_options, default_options.output, true);

	// 1. Parse
	var toplevel_ast = parse(code, parse_options);
	toplevel_ast.figure_out_scope();

	// 2. Compress
	var compressor = new Compressor(compress_options);
	var compressed_ast = toplevel_ast.transform(compressor);

	// 3. Mangle
	compressed_ast.figure_out_scope();
	compressed_ast.compute_char_frequency();
	compressed_ast.mangle_names();

	// 4. Generate output
	code = compressed_ast.print_to_string(output_options);

	return code;
}


// Handle the UI

var uglify_options;
var $options = $('options');
var $options_btn = $('options-btn');
var $options_reset = $('options-reset');
var $go = $('go');
var $out = $('out');
var $out_container = $('out-container');
var $in = $('in');
var $info = $('info');
var $error = $('error');
var $error_container = $('error-container');
var $stats = $('stats');

function $(id) {
	return document.getElementById(id);
}

var console = window.console || { log: function () {}, error: function () {} };

set_options_initial();

$go.onclick = go;
$options_btn.onclick = toggle_options;
$options_reset.onclick = reset_options;
$out.onfocus = select_text;

function show() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].className = '';
	}
}

function hide() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].className = 'hidden';
	}
}

function toggle_options() {
	if ($options.className === 'hidden') {
		$options_btn.className = 'active';
		hide($in, $go);
		show($options, $options_reset);
		$options.focus();
	} else {
		if (set_options()) {
			hide($options, $options_reset);
			$options_btn.className = '';
			show($in, $go);
			$in.focus();
		}
	}
}

function get_options(value) {
	/*jshint evil:true */
	return new Function('return (' + (value || $options.value) + ');')();
}

function set_options() {
	var old_options = uglify_options;
	try {
		uglify_options = get_options();
		go(true);
		return true;
	} catch (e) {
		if (e instanceof JS_Parse_Error) {
			// the options are actually okay, just the code that's bad
			show_error(e, $in.value);
			return true;
		} else {
			uglify_options = old_options;
			show_error(e);
			return false;
		}
	}
}

function reset_options() {
	$options.value = $options.textContent || $options.innerText;
	toggle_options();
}

function set_options_initial() {
	var default_options_text = $options.textContent || $options.innerText;
	default_options = get_options(default_options_text);
	try {
		uglify_options = get_options();
	} catch (e) {
		// if it didn't work, reset the textarea
		$options.value = default_options_text;
		uglify_options = default_options;
	}
}

function encodeHTML(str) {
	return (str + '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/"/g, '&quot;');
}

function go(throw_on_error) {
	var input = $in.value;

	if (throw_on_error === true) {
		main();
	} else {
		try {
			main();
		} catch (e) {
			show_error(e, input);
		}
	}

	function main() {
		var res = uglify(input, uglify_options);
		hide($info, $error_container);
		show($out_container);

		$out.value = res || '/* no output! */';
		$stats.innerHTML = res.length + ' bytes, saved ' + ((1 - res.length / input.length) * 100).toFixed(2) + '%';
	}
}

function show_error(e, param) {
	console.error('Error', e);
	hide($info, $out_container);
	show($error_container);

	if (e instanceof JS_Parse_Error) {
		var input = param;
		var lines = input.split('\n');
		var line = lines[e.line - 1];
		e = 'Parse error: <strong>' + encodeHTML(e.message) + '</strong>\n' +
			'<small>Line ' + e.line + ', column ' + e.col + '</small>\n\n' +
			(lines[e.line-2] ? (e.line - 1) + ': ' + encodeHTML(lines[e.line-2]) + '\n' : '') +
			e.line + ': ' +
				encodeHTML(line.substr(0, e.col)) +
				'<mark>' + encodeHTML(line.substr(e.col, 1) || ' ') + '</mark>' +
				encodeHTML(line.substr(e.col + 1)) + '\n' +
			(lines[e.line] ? (e.line + 1) + ': ' + encodeHTML(lines[e.line]) : '');
	} else if (e instanceof DefaultsError) {
		e = '<strong>' + encodeHTML(e.msg) + '</strong>';
	} else if (e instanceof Error) {
		e = e.name + ': <strong>' + encodeHTML(e.message) + '</strong>';
	} else {
		e = '<strong>' + encodeHTML(e) + '</strong>';
	}

	$error.innerHTML = e;
}

function select_text() {
	/*jshint validthis:true */
	var self = this;
	self.select();

	self.onmouseup = self.onkeyup = function() {
		// Prevent further mouseup intervention
		self.onmouseup = self.onkeyup = null;
		self.scrollTop = 0;
		return false;
	};
	return false;
}
