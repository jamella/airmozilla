/*global $, setupJSTime */

var Timenails = (function() {
    'use strict';

    var parent = $('#timenails');

    var timenails = {};

    var renderTimenails = function() {
        var innerContainer = $('.timenails', parent);
        $('a', innerContainer).remove();

        $.each(timenails, function(at, picture) {
            var title = 'At ' + formatSeconds(at);
            title += ' (Similarity: ' +
            Math.round(picture.similarity, 2) + '%)';
            var similaritySpan = $('<span>')
            .addClass('similarity')
            .text(Math.round(picture.similarity, 2) + '%')
            .hide();

            $('<a>')
            .attr('href', picture.thumbnail.url)
            .attr('title', title)
            .addClass('timenail')
            .data('similarity', picture.similarity)
            .on('click', function(event) {
                event.preventDefault();
                callback(parseInt(at, 10));
            })
            .append(
                $('<img>')
                .attr('alt', formatSeconds(at))
                .attr('src', picture.thumbnail.url)
            )
            .append(similaritySpan)
            .appendTo(innerContainer);
        });
        if (!parent.is(':visible')) {
            // delay slightly to make sure the thumbnails have loaded.
            setTimeout(function() {
                parent.fadeIn(400);
            }, 1000);
        }
    };

    var fetchThumbnails = function() {
        $.getJSON('thumbnails')
        .done(function(response) {
            if (response.missing) {
                // recurse soon
                setTimeout(fetchThumbnails, 60 * 1000);
                $('.loading-more-timenails .missing', parent)
                .text(response.missing);
                $('.loading-more-timenails', parent).show();
            } else {
                $('.loading-more-timenails', parent).hide();
                $('p.similarity', parent).show();
            }
            $.each(response.pictures, function(i, picture) {
                timenails[picture.at] = picture;
            });
            renderTimenails();
        })
        .fail(function() {
            console.error.apply(console, arguments);
        });
    };

    var callback = null;

    var filterTimenails = function(min) {
        $('.timenails a', parent).each(function() {
            var element = $(this);
            if (element.data('similarity') === null || element.data('similarity') >= min) {
                element.show();
            } else {
                element.hide();
            }
        });
    };

    return {
        setup: function(cb) {
            callback = cb;
            fetchThumbnails();

            // var rangeThrottle = null;
            var hideSimilarityNumber = null;
            var range = parseInt($('input[type="range"]', parent).val(), 10);
            filterTimenails(range);
            $('.similarity span').text(range + '%');
            $('input[type="range"]', parent).on('input', function(event) {
                $('.timenails span.similarity').show();
                range = parseInt($(this).val());
                $('.similarity span').text(range + '%');
                filterTimenails(range);
                if (hideSimilarityNumber) {
                    clearTimeout(hideSimilarityNumber);
                }
                hideSimilarityNumber = setTimeout(function() {
                    $('.timenails span.similarity').fadeOut(400);
                }, 2000);
            });
        }
    };

})();


function formatSeconds(s) {
    // for example, if s===70 we return "1m10s"
    if (!s) {
        return '0s';
    }
    var hours = Math.floor(s / 3600);
    var seconds = s % 3600;
    var minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;
    var out = [];
    if (hours) {
        out.push(hours + 'h');
    }
    if (hours || minutes) {
        out.push(minutes + 'm');
    }
    if (hours || minutes || seconds) {
        out.push(seconds + 's');
    }
    return out.join('');
}


$(function() {
    'use strict';

    function formatUser(user) {
        if (user.first_name) {
            return (user.first_name + ' ' + user.last_name).trim();
        }
        return user.email;
    }

    function wrapUser(name, maxLength) {
        var short = name;
        maxLength = maxLength || 18;
        if (short.length > maxLength) {
            short = short.substr(0, maxLength) + '…';
        }
        return $('<span>').attr('title', name).text(short);
    }

    function renderChapters(chapters) {
        var table = $('table.chapters');
        $('tbody tr', table).remove();
        $.each(chapters, function(i, chapter) {
            $('<tr>')
                .append($('<td>')
                    .append($('<button type="button">')
                        .text('Edit')
                        .addClass('edit')
                        .data('timestamp', chapter.timestamp)
                        .data('text', chapter.text)
                    ))
                .append($('<td>').text(formatSeconds(chapter.timestamp)))
                .append($('<td>').text(chapter.text).addClass('text'))
                .append($('<td>')
                    .addClass('user')
                    .append(wrapUser(formatUser(chapter.user)))
                )
                .append($('<td>').html(chapter.js_date_tag))
                .appendTo($('tbody', table));
        });
        setupJSTime(table);
    }

    var $form = $('form[method="post"]');

    var currentTime;
    var timestampDisplay = $('.timestamp', $form);
    function updateCurrentTime(time) {
        currentTime = time;
        timestampDisplay.text(formatSeconds(time));
    }

    function fetchChapters() {
        return $.getJSON(location.pathname, {'all': true})
        .then(function(response) {
            renderChapters(response.chapters);
            $('.loading-chapters').hide();
            $('table.chapters').show();
        })
        .fail(function() {
            // need to do something more constructive here
            console.error.apply(console, arguments);
            $('.failed').show();
            $('table.chapters').hide();
        });
    }
    // on load
    fetchChapters();

    var jwplayer_player = null;
    var playing = false;
    var attempts = 0;
    var waiter = setInterval(function() {
        if (typeof jwplayer === 'function' &&
            typeof playerid !== 'undefined' &&
            jwplayer(playerid).getState())
        {
            // Yay! It's loaded!
            updateCurrentTime(0);
            $('.adding').show();
            jwplayer_player = jwplayer();
            jwplayer_player.onTime(function(event) {
                var positionSecond = parseInt(event.position, 10);
                if (positionSecond != currentTime) {
                    updateCurrentTime(positionSecond);
                }
            });
            jwplayer_player.onPlay(function(event) {
                playing = true;
                $('button.play').hide();
                $('button.pause').show();
                $('button.seek').show();
            });
            jwplayer_player.onPause(function(event) {
                playing = false;
                $('button.pause').hide();
                $('button.play').show();
                $('button.seek').show();
                $('button.cancel').show();
                $('form input[name="text"]').focus();
            });
            jwplayer_player.on('seek', function(event) {
                if (!playing) {
                    // If the state is supposed to be that it's not playing
                    // then force it to pause after the seek.
                    pauseJWPlayer();
                }

            });
            clearInterval(waiter);
        } else {
            attempts++;
            if (attempts > 6) {
                clearInterval(waiter);
                console.error('Unable to load jwplayer');
            }
        }
    }, 500);

    var pauseJWPlayer = function() {
        // repeatedly try to pause until the state changes.
        var repeat = setInterval(function() {
            if (jwplayer_player.getState() === 'paused') {
                clearInterval(repeat);
            } else {
                jwplayer_player.pause();
            }
        }, 100);
    };

    $('form .adding').on('click', 'button.play', function() {
        jwplayer_player.play();
        $(this).hide();
        $('button.pause').show();
    });
    $('form .adding').on('click', 'button.pause', function() {
        jwplayer_player.pause();
        $(this).hide();
        $('button.play').show();
        $('form input[name="text"]').focus();
    });
    $('form .adding').on('click', 'button.seek', function() {
        var seek = $(this).data('seek');
        // If currentTime + seek  becomes a negative number, it's fine.
        jwplayer_player.seek(currentTime + seek);
    });

    $('table.chapters').on('click', 'button.edit', function() {
        if (playing) {
            jwplayer_player.pause();
            playing = false;
        }
        var $button = $(this);
        var timestamp = $button.data('timestamp');
        var text = $button.data('text');
        updateCurrentTime(timestamp);
        $('input[name="text"]', $form).val(text).focus();
        $('button[name="cancel"], button[name="delete"]').show();
    });

    $form.on('click', 'button.cancel', function() {
        $('input[name="text"]').val('');
        $('button.cancel').hide();
        $('button.delete').hide();
        if (!playing) {
            jwplayer_player.play();
            playing = true;
        }
    });

    $form.on('click', 'button.delete', function() {
        if (confirm("Are you sure you want to delete this chapter?")) {
            var data = {
                delete: true,
                timestamp: currentTime,
                csrfmiddlewaretoken: $('input[name="csrfmiddlewaretoken"]', $form).val(),
            };
            $.post(location.pathname, data)
            .then(function(response) {
                $('input[name="text"]', $form).val('');
                fetchChapters();
                $('button.cancel, button.delete').hide();
            })
            .fail(function() {
                // need to do something more constructive here
                console.error.apply(console, arguments);
                $('.failed').show();
            })
            .always(function() {
                $('.saving').hide();
            });
        }

    });

    $form.on('focus', 'input[name="text"]', function() {
        if (playing) {
            jwplayer_player.pause();
        }
    });

    $form.on('submit', function() {
        if (playing) {
            alert("Pause first, to select the exact time stamp.");
            return false;
        }
        var $text = $('input[name="text"]', $form);
        var text = $text.val().trim();
        if (!text.length) {
            return false;
        }

        $('.saving').show();
        $('.failed').hide();
        $('.errored').hide();
        var data = {
            timestamp: currentTime,
            text: text,
            csrfmiddlewaretoken: $('input[name="csrfmiddlewaretoken"]', $form).val(),
        };
        $.post(location.pathname, data)
        .then(function(response) {
            if (response.errors) {
                $('dt, dd', '.errored').remove();
                var $dl = $('.errored dl');
                $.each(response.errors, function(key, values) {
                    $('<dt>').text(key).appendTo($dl);
                    $.each(values, function(i, value) {
                        $('<dd>').text(value).appendTo($dl);
                    });
                });
                $('.errored').show();
            } else {
                $text.val('');
                fetchChapters();
                $('button.cancel, button.delete').hide();
            }
        })
        .fail(function() {
            // need to do something more constructive here
            console.error.apply(console, arguments);
            $('.failed').show();
        })
        .always(function() {
            $('.saving').hide();
        });
        return false;
    });

    Timenails.setup(function(at) {
        // Was there already a chapter at this timestamp?
        var wasEdit = false;
        $('button.edit').each(function(i, button) {
            if ($(this).data('timestamp') === at) {
                $(this).click();
                wasEdit = true;
            }
        });
        if (!wasEdit) {
            playing = false;
            updateCurrentTime(at);
            jwplayer_player.seek(at);
            $('input[name="text"]', $form).focus();
        }
    });
});
