{
    // TODO:
    // synchronizacia viac vytahov kto na dane poschodie pojde ?
    // pri idle treba rozhodovat kam pojde podla najstarsieho timestamp
    // ked uz idem nejakym smerom (^/v) tak idem az do maxima kde som bol privolany

    
    init: function(elevators, floors) {
        var startTime = getTimestamp();
        
        // -----------------------------------
        //   utils
        // -----------------------------------
        function removeFrom(arr, elem) {
            f = function(e) {return elem != e;};
            return arr.filter(f);
        }

        function getDir(direction) {
            return (direction == "stopped") ? 0 : ((direction == "up") ? 1 : -1);
        }
        
        function getElevatorIndex(elObj) {
            for(var i=0 ; i<elevators.length ; i++) {
                if(elevators[i] === elObj) {
                    return i;
                }
            }
        }
        
        function getTimestamp() {
            return Date.now();
        }
        
        function getTimeElapsed() {
            return getTimestamp() - startTime;
        }
        
        function log(elObj, msg) {
            console.log(getTimeElapsed() + " ELEV " + getElevatorIndex(elObj) + ": " + msg);
        }
        
        function sort(arr, asc) {
            var f;
            if(asc) { f = function(a,b) {return a-b}; }
            else { f = function(a,b) {return b-a}; }
            return arr.sort(f);
        }
        
        // ------------------------------------------------
        //   logic
        // ------------------------------------------------
        // if the floor button has been pressed in the currect direction and there is space in the elevator
        function shouldStopAt(elObj, flObj) {
            if(elObj.destinationDirection() == "up" 
               && flObj.up > 0 
               && elObj.loadFactor() < (elObj.maxPassengerCount()-1.5)/elObj.maxPassengerCount()) {
                return true;
            }
            if(elObj.destinationDirection() == "down" 
               && flObj.down > 0 
               && elObj.loadFactor() < (elObj.maxPassengerCount()-1.5)/elObj.maxPassengerCount()) {
                return true;
            }
            log(elObj,"NOT stopping at " + flObj.floorNum());
            return false;
        }


        function getNextDest(elObj) {
            console.log("getNextDest: dir=" + elObj.getDir());
            var dest = 0; // 0 or -1 ? most people appear at 0, but moving to 0 takes time...
            
            // take into account who is waiting the longest time
            var oldestTime = getTimeElapsed();
            for(var i=1 ; i<floors.length ; i++) {
                var floorTime = floors[i].getMinTime();
                if (floorTime < oldestTime) {
                    dest = i;
                    oldestTime = floorTime
                }
            }
            log(elObj,"next destination " + dest);
            return dest;
        }

        // -------------------------------------------
        //   event handlers
        // -------------------------------------------
        function onFloorButtonPressed(flObj, dir) {
            console.log("FLOOR " + flObj.floorNum() + ": pressed " + (dir>0 ? "UP" : "DOWN"));
            var i = flObj.floorNum();
        }

        function onElevatorFloorButtonPressed(elObj, flNum) {
            log(elObj, "pressed " + flNum);
            var dest = flNum; // improve logic: ked uz idem nejakym smerom (^/v) tak idem az do maxima kde som bol privolany
            elObj.setDir(dest - elObj.currentFloor());
            elObj.goToFloor(dest);
            
            elObj.destinationQueue = sort(elObj.destinationQueue, elObj.getDir()>0);
            elObj.checkDestinationQueue();
        }

        function onElevatorStopped(elObj, flNum) {
            log(elObj, "stopped at " + flNum);
            if(elObj.destinationQueue.length > 0) {
                log(elObj, "  -going to " + elObj.destinationQueue[0]);
                elObj.setDir(elObj.destinationQueue[0] - flNum);
            } else {
                elObj.setDir(0);
            }

            if(elObj.getDir() >= 0) { // ??? with equal the elevator doesn't stop at empty floors
                floors[flNum].up = 0;
                floors[flNum].upTime = -1;
            }
            if(elObj.getDir() <= 0) {
                floors[flNum].down = 0;
                floors[flNum].downTime = -1;
            }
        }

        function onElevatorIdle(elObj) {
            log(elObj, "idle at " + elObj.currentFloor());
            var dest = getNextDest(elObj);
            if(dest >= 0) {
                elObj.goToFloor(dest);
            }
        }

        // not triggered for destination
        function onElevatorPassing(elObj, floorNum) {
            log(elObj, "passing " + floorNum);
            if(shouldStopAt(elObj, floors[floorNum])) {
                elObj.goToFloor(floorNum, true);
            }
        }

        // ===================================================================
        // init
        elevators.forEach(function (elevator) {
            // Whenever the elevator is idle (has no more queued destinations)
            elevator.on("idle", function() { onElevatorIdle(elevator); });
            elevator.on("passing_floor", function(floorNum, direction) { onElevatorPassing(elevator, floorNum); });
            elevator.on("stopped_at_floor", function(floorNum) { onElevatorStopped(elevator, floorNum); });
            elevator.on("floor_button_pressed", function(floorNum) { onElevatorFloorButtonPressed(elevator, floorNum); });

            elevator.resetIndicators = function() { elevator.goingDownIndicator(true); elevator.goingUpIndicator(true); }
            elevator.getDir = function() { return elevator.dir; }
            elevator.setDir = function(d) { 
                elevator.dir=d; 
                if(d>0) {
                    elevator.goingDownIndicator(false);
                    elevator.goingUpIndicator(true);
                }
                if(d<0) {
                    elevator.goingDownIndicator(true);
                    elevator.goingUpIndicator(false);
                }
                if(d==0) {
                    elevator.resetIndicators();
                }
            }

            elevator.setDir(1);
        });

        floors.forEach(function (floor) {
            floor.up = 0;
            floor.down = 0;
            floor.upTime = -1; // oldest timestamp when the button was pressed, reset when stopping at floor
            floor.downTime = -1;

            floor.on("down_button_pressed", function() {
                floor.down++;
                if(floor.downTime == -1) { floor.downTime = getTimeElapsed(); }
                onFloorButtonPressed(floor, -1);
            });
            floor.on("up_button_pressed", function() {
                floor.up++;
                if(floor.upTime == -1) { floor.upTime = getTimeElapsed(); }
                onFloorButtonPressed(floor, 1);
            });
            
            floor.getMinTime = function() {
                if(floor.upTime != -1) {
                    return (floor.downTime != -1) ? Math.min(floor.upTime, floor.downTime) : floor.upTime
                } else {
                    return (floor.downTime != -1) ? floor.downTime : getTimeElapsed();
                }
                
            };
        });
    },

    update: function(dt, elevators, floors) {
        // We normally don't need to do anything here
    }
}    