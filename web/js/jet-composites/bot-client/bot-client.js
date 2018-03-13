/******************************************************************************
 Copyright (c) 2016-2017, Oracle and/or its affiliates. All rights reserved.
 
 $revision_history$
 20-nov-2017   Alex Moldovan, add send button to use on mobile
 15-aug-2017   Steven Davelaar, Oracle A-Team
 1.2           Cleaned up the code
 12-jan-2017   Steven Davelaar, Oracle A-Team
 1.1           Modified for use with Intelligent Bots
 27-oct-2016   Steven Davelaar & Lydumil Pelov, Oracle A-Team
 1.0           initial creation
******************************************************************************/
define(['ojs/ojcore', 'knockout', 'jquery', './reconnecting-websocket', 'ojs/ojinputtext', 'ojs/ojknockout', 'promise', 'ojs/ojlistview', 'ojs/ojarraytabledatasource', 'ojs/ojfilmstrip', 'ojs/ojdialog'],
    function(oj, ko, $, ReconnectingWebSocket) {
        function model(context) {
            var self = this;
            var messageToBot;
            var currentConnection;

            self.waitingForText = ko.observable(false);

            var LOCATION_TYPE = 'location';
            var POSTBACK_TYPE = 'postback';
            var ws;
            context.props.then(function(properties) {
                self.properties = properties;
                initMessageToBot(self.properties.channel);
                ReconnectingWebSocket.debugAll = false;
                initWebSocketIfNeeded();
            });

            // close websocket connection when we leave page with tester CCA      
            self.dispose = function(context) {
                if (ws) {
                    ws.close();
                }
            }

            var initWebSocketIfNeeded = function() {
                var connection = self.properties.websocketConnectionUrl + "?user=" + self.properties.userId;
                if (connection !== currentConnection) {
                    currentConnection = connection;
                    ws = new ReconnectingWebSocket(connection);
                    ws.onmessage = function(evt) {
                        self.waitingForText(false);
                        //                debug("Message received 1: "+evt.data);
                        var response = JSON.parse(evt.data);
                        var text = "";
                        var choices;
                        if (response.hasOwnProperty('body')) {
                            text = JSON.parse(evt.data).body.text;
                            choices = JSON.parse(evt.data).body.choices;
                        } else if (response.hasOwnProperty('error')) {
                            text = response.error.message;
                        }
                        debug("Message received: " + text);
                        if (text.startsWith('{')) {
                            // response from A-Team component
                            var msg = JSON.parse(text);
                        } else {
                            // response from built-in component
                            var responseItem = {
                                type: 'prompt',
                                prompt: text
                            };
                            // convert List component choices to CMM options
                            if (choices) {
                                var options = choices.map(function(choice) {
                                    return {
                                        "prompt": choice,
                                        "payload": choice,
                                        "type": "postback"
                                    }
                                });
                                responseItem.options = options;
                            }
                            msg = {
                                items: [responseItem]
                            };
                        }
                        addShortenedCardsUrlIfNeeded(msg);
                        self.addItem(msg, true);
                    };

                    ws.onclose = function() {
                        debug("Connection is closed...");
                    };

                    ws.onerror = function(error) {
                        self.waitingForText(false);
                        self.onerror(error);
                    };
                }

            }

            var addShortenedCardsUrlIfNeeded = function(msg) {
                if (msg.hasOwnProperty("items")) {
                    msg.items.forEach(function(item) {
                        if (item.hasOwnProperty("cards")) {
                            item.cards.forEach(function(card) {
                                if (card.hasOwnProperty("cardUrl")) {
                                    card.shortCardUrl = getDisplayUrl(card.cardUrl);
                                }
                            })
                        }
                    })

                }
            }

            self.value = ko.observable("");
            self.itemToAdd = ko.observable("");
            self.scrollPos = ko.observable(5000);

            self.reset = function() {
                // re-init websocket when userId or connection url has changed
                initWebSocketIfNeeded();
                // clear message history
                self.allItems([]);
                // re-init messageToBot to pick up changes to channel id
                initMessageToBot(self.properties.channel);
            }

            var initMessageToBot = function(channel) {
                messageToBot = {
                    "to": {
                        "type": "bot",
                        "id": channel
                    }
                };
            }

            var getDisplayUrl = function(url) {
                var pos = url.indexOf("://");
                var startpos = pos === -1 ? 0 : pos + 3;
                var endpos = url.indexOf('/', startpos);
                endpos = endpos === -1 ? url.length : endpos;
                return url.substring(startpos, endpos);
            }

            // send message to the bot
            var sendToBot = function(message, isAcknowledge) {
                // wait for websocket until open
                waitForSocketConnection(ws, function() {
                    self.waitingForText(true);
                    ws.send(JSON.stringify(message));
                    debug('Message sent: ' + JSON.stringify(message));
                });
            }

            var waitForSocketConnection = function(socket, callback) {
                setTimeout(
                    function() {
                        if (socket.readyState === 1) {
                            callback();
                            return;

                        } else {
                            debug("waiting for connection...")
                            waitForSocketConnection(socket, callback);
                        }

                    }, 1000); // wait 1 second for the connection...
            }
            var debug = function(msg) {
                console.log(msg);
            };

            self.onerror = function(error) {
                console.error('WebSocket Error;', error);
            };

            function scrollBottom(el) {
                setTimeout(function() {
                    // scroll down to the bottom
                    $("body").animate({
                        scrollTop: !el ? $(window).height() : el.scrollHeight //el.offsetHeight
                    }, 1000);
                    /* increase / decrease animation speed */
                }, 100);
            }

            ko.extenders.scrollFollow = function(target, selector) {
                target.subscribe(function(newval) {
                    var el = document.querySelector(selector);

                    // check to see if you should scroll now?
                    //if (el.scrollTop == el.scrollHeight - el.clientHeight) {
                    scrollBottom(el);
                    //}
                });

                return target;
            };

            self.allItems = ko.observableArray([]).extend({
                scrollFollow: '#listview'
            });
            var lastItemId = self.allItems().length;
            if (lastItemId > 1)
                scrollBottom();

            //self.dataSource = new oj.ArrayTableDataSource(self.allItems, {idAttribute: "id"})

            self.sendBtn = function(context, ui) {
                var valueObj = $('#text-input').val();

                messageToBot.text = valueObj;

                self.addItem(valueObj, false);
                self.value("");
                sendToBot(messageToBot);
            };

            self.addItem = function(value, isBot) {
                // TODO: don't add if value is empty!
                lastItemId++;
                self.allItems.push({
                    id: lastItemId,
                    payload: value,
                    bot: isBot
                });
            };

            // this will be when typing!
            self.valueChangeHandler = function(context, ui) {
                //var eventTime = getCuttentTime();
                if (ui.option === "value") {
                    var valueObj = {
                        previousValue: ui.previousValue,
                        value: ui.value
                    };

                    // do only if enter!
                    if (context.keyCode === 13) {
                        // Free text is entered
                        messageToBot.text = valueObj.value;

                        self.addItem(valueObj.value, false);
                        self.value("");
                        sendToBot(messageToBot);
                    }
                }
            };

            self.notSupportedMessage = ko.observable();

            // predefined selection!
            self.onClientSelection = function(prompt, payload, type) {
                self.addItem(prompt, false);
                if (!type || type === POSTBACK_TYPE) {
                    var pl = (typeof payload === 'object') ? JSON.stringify(payload) : payload;
                    messageToBot.text = pl;
                    sendToBot(messageToBot);
                } else if (type && type === LOCATION_TYPE) {
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(function(position) {
                            messageToBot.text = JSON.stringify({
                                event: 'locationSent',
                                value: {
                                    "lat": position.coords.latitude,
                                    "long": position.coords.longitude
                                }
                            });
                            sendToBot(messageToBot);
                        });
                    } else {
                        self.notSupportedMessage('Geo location is not supported by this browser');
                        $("#notSupportedDialog").ojDialog("open");
                    }
                } else {
                    self.notSupportedMessage('Option type ' + type + ' is not supported in tester');
                    $("#notSupportedDialog").ojDialog("open");
                }
            };

            self.closeNotSupportedDialog = function() {
                $("#notSupportedDialog").ojDialog("close");
            }

            // film trip properties!
            // self.currentNavArrowPlacement = ko.observable("adjacent");
            // self.currentNavArrowVisibility = ko.observable("auto");
            self.currentNavArrowPlacement = ko.observable("overlay");
            self.currentNavArrowVisibility = ko.observable("hidden");

            self.buttonClick = function(data, event) {
                //self.clickedButton(event.currentTarget.id);
                console.log(event.currentTarget.id);
                return true;
            }

        }
        return model;
    }
)