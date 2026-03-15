import Time "mo:core/Time";
import Float "mo:core/Float";
import Array "mo:core/Array";
import Order "mo:core/Order";

actor {
  type SpeedTestResult = {
    downloadSpeed : Float;
    uploadSpeed : Float;
    ping : Nat;
    timestamp : Time.Time;
  };

  module SpeedTestResult {
    public func compare(a : SpeedTestResult, b : SpeedTestResult) : Order.Order {
      if (a.timestamp > b.timestamp) { #greater } else if (a.timestamp < b.timestamp) { #less } else {
        #equal;
      };
    };
  };

  var results : [SpeedTestResult] = [];
  var currentIndex = 0;
  var size = 0;

  public shared ({ caller }) func addResult(downloadSpeed : Float, uploadSpeed : Float, ping : Nat) : async () {
    let result : SpeedTestResult = {
      downloadSpeed;
      uploadSpeed;
      ping;
      timestamp = Time.now();
    };

    if (size < 10) {
      results := results.concat([result]);
      size += 1;
    } else {
      results := Array.tabulate(
        10,
        func(i) {
          if (i == currentIndex) {
            result;
          } else { results[i] };
        },
      );
    };

    currentIndex := (currentIndex + 1) % 10;
  };

  public query ({ caller }) func getResults() : async [SpeedTestResult] {
    results.reverse().sort();
  };
};
