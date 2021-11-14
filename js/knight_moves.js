const COORD_TO_ALG = {
    0: "a",
    1: "b",
    2: "c",
    3: "d",
    4: "e",
    5: "f",
    6: "g",
    7: "h"
};
const ALG_TO_COORD = {
    "a": 0,
    "b": 1,
    "c": 2,
    "d": 3,
    "e": 4,
    "f": 5,
    "g": 6,
    "h": 7
};

const ROW = [2, 2, -2, -2, 1, 1, -1, -1];
const COL = [-1, 1, 1, -1, 2, -2, 2, -2];

var board = null;
var $board = $("#board");
var score = 0;
var $score = $("#score");
var rounds = 0;
var max_rounds = 10;
var $max_rounds = $("#max_rounds");

const snd_success = new Audio("static/click.ogg");
const snd_fail = new Audio("static/error.ogg");

function random_int(max) {
    return Math.floor(Math.random() * (max + 1));
}

function coord_to_alg(x, y) {
    return COORD_TO_ALG[x] + (y + 1);
}

function alg_to_coord(coord) {
    return [ALG_TO_COORD[coord[0]], coord[1] - 1];
}

function is_white(x, y) {
    if (y % 2 == 0) {
        return x % 2 != 0;
    } else {
        return x % 2 == 0;
    }
}

function get_min_distance(source, destination, avoid = []) {
    // BFS to find minimal number of knight moves from source to destination
    var to_visit = [
        [source, 0]
    ];
    const visited = new Set();
    while (to_visit.length > 0) {

        const [node, distance] = to_visit.shift();
        visited.add(node);
        if (node == destination) {
            return distance;
        }
        get_knight_moves(node).forEach(move => {
            if (visited.has(move)) {
                // do not visit square multiple times
                return;
            }
            if (avoid.includes(move)) {
                // do not go to forbidden square
                return;
            }
            to_visit.push([move, distance + 1]);
        });
    }
}

function is_knight_move(source, destination) {
    const [source_x, source_y] = alg_to_coord(source);
    const [destination_x, destination_y] = alg_to_coord(destination);
    const y_diff = Math.abs(source_y - destination_y);
    const x_diff = Math.abs(source_x - destination_x);
    return (y_diff == 1 && x_diff == 2) || (y_diff == 2 && x_diff == 1);
}

function get_knight_moves(square) {
    // Return all legal knight moves from square
    var result = [];

    const [x, y] = alg_to_coord(square);

    var i;
    for (i = 0; i < 8; i++) {
        const new_x = x + COL[i];
        const new_y = y + ROW[i];
        if (new_x >= 0 && new_x <= 7 && new_y >= 0 && new_y <= 7) {
            result.push(coord_to_alg(new_x, new_y));
        }
    }
    return result;
}

function random_square() {
    // Return the algebraic notation of a random square
    return coord_to_alg(random_int(7), random_int(7));
}

function get_square(square) {
    return $board.find("#board_chess_square_" + ChessUtils.convertNotationSquareToIndex(square));
}

class Game {
    constructor() {
      this.cur_position = random_square();
      this.targets = [random_square()];
      this.num_moves = null;
      this.distance = null;
    }

    highlight() {
        if (is_white(...alg_to_coord(this.targets[0]))) {
            get_square(this.targets[0]).addClass("highlight_white");
        } else {
            get_square(this.targets[0]).addClass("highlight_black");
        }
    }

    remove_highlights() {
        get_square(this.targets[0]).removeClass("highlight_white");
        get_square(this.targets[0]).removeClass("highlight_black");
    }

    next_round() {
        this.remove_highlights();
        var new_target = random_square();
        while (new_target == this.targets[0]) {
            new_target = random_square();
        }
        this.targets = [new_target];

        this.distance = get_min_distance(this.cur_position, this.targets[0]);
        this.highlight();
        this.num_moves = 0;
    }

    move_to(destination) {
        if (!is_knight_move(this.cur_position, destination)) {
            return false;
        }
        this.num_moves++;
        this.cur_position = destination;
        return true;
    }

    is_finished() {
        return this.targets.includes(this.cur_position);
    }

    is_won() {
        console.log("took " + this.num_moves + " moves");
        return this.num_moves == this.distance;
    }
}

class ForkMode extends Game {
    constructor() {
      super();
      this.fork_targets = [];
    }

    highlight() {
        this.fork_targets.forEach(square => {
            if (is_white(...alg_to_coord(square))) {
                get_square(square).addClass("highlight_white");
            } else {
                get_square(square).addClass("highlight_black");
            }
        });
    }

    remove_highlights() {
        this.fork_targets.forEach(square => get_square(square).removeClass("highlight_white"));
        this.fork_targets.forEach(square => get_square(square).removeClass("highlight_black"));
    }

    next_round() {
        this.remove_highlights();
        var new_target = random_square();

        this.fork_targets = get_knight_moves(new_target).slice(0, 2);

        // TODO can make nicer? I just want the intersection between reachable_from_fork_targets_*
        this.targets = [];
        const reachable_from_fork_target_1 = get_knight_moves(this.fork_targets[0]).sort();
        const reachable_from_fork_target_2 = get_knight_moves(this.fork_targets[1]).sort();
        for (let i = 0; i < reachable_from_fork_target_1.length; i++) {
            for (let j = 0; j < reachable_from_fork_target_2.length; j++) {
                if (reachable_from_fork_target_1[i].toString() == reachable_from_fork_target_2[j].toString()) {
                    this.targets.push(reachable_from_fork_target_1[i]);
                }
            }
        }

        const distances = this.targets.map(target => get_min_distance(this.cur_position, target, this.fork_targets)).filter(e => e);
        this.distance = Math.min(...distances);
        this.highlight();
        this.num_moves = 0;

        if (this.targets.includes(this.cur_position) || this.fork_targets.includes(this.cur_position)) {
            console.log("current position is in new targets. rerolling...");
            this.next_round();
            return;
        }
    }

    move_to(destination) {
        // Do not pass over fork targets
        return !this.fork_targets.includes(destination) &&
            Game.prototype.move_to.call(this, destination);
    }
}

function play(game, timer) {
    $max_rounds.html(max_rounds);
    game.next_round();

    function on_select(square) {
        if (game.is_finished() && rounds == max_rounds) {
            return;
        }
        return get_knight_moves(square).map(s => ChessUtils.convertNotationSquareToIndex(s));
    }

    function on_move(move) {
        if (timer.state != "running") {
            timer.start();
        }

        game.move_to(move.to);

        if (game.is_finished()) {
            rounds++;
            if (game.is_won()) {
                snd_success.play();
                console.log("score");
                score++;
            } else {
                snd_fail.play();
                console.log("wrong");
            }
            $score.html(score);
            if (rounds == max_rounds) {
                timer.stop();
            } else {
                game.next_round();
            }
        }

        return {
            [move.to]: "wN"
        };
    }

    const config = {
        eventHandlers: {
            onPieceSelected: on_select,
            onMove: on_move,
        },
        useAnimation: false,
        showNextMove: false,
        position: {
            [game.cur_position]: "wN"
        }
    };

    board = new Chessboard("board", config);
    game.highlight();
}
