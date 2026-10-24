package com.example.backend.web;

import com.example.backend.auth.CurrentUser;
import com.example.backend.billing.SubscriptionService;
import com.example.backend.web.Dtos.BillingOverviewDto;
import com.example.backend.web.Dtos.ChangePlanInput;
import com.example.backend.web.Dtos.ChangeResultDto;
import com.example.backend.web.Dtos.CheckoutDto;
import com.example.backend.web.Dtos.SubscribeInput;
import jakarta.validation.Valid;
import java.net.URI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Plans and payments. The plan, limits and read-only state are also part of {@code GET /bootstrap}.
 * {@code /newebpay/*} are NewebPay's callbacks (form posts, no token): the browser returning from
 * the payment page (redirected back into the app) and server-to-server notifications.
 */
@RestController
@RequestMapping("/api/billing")
public class BillingController {

    private static final Logger log = LoggerFactory.getLogger(BillingController.class);

    private final SubscriptionService subscriptions;

    public BillingController(SubscriptionService subscriptions) {
        this.subscriptions = subscriptions;
    }

    @GetMapping
    public BillingOverviewDto overview(CurrentUser user) {
        return subscriptions.overview(user);
    }

    @PostMapping("/subscribe")
    public CheckoutDto subscribe(CurrentUser user, @Valid @RequestBody SubscribeInput in) {
        return subscriptions.subscribe(user, in);
    }

    @PostMapping("/change")
    public ChangeResultDto change(CurrentUser user, @Valid @RequestBody ChangePlanInput in) {
        return subscriptions.change(user, in);
    }

    /** Studio → free coach: now without a running subscription, otherwise from the next renewal. applied: done now. */
    @PostMapping("/downgrade")
    public ChangeResultDto downgrade(CurrentUser user) {
        return subscriptions.downgradeToPro(user);
    }

    @DeleteMapping("/downgrade")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelDowngrade(CurrentUser user) {
        subscriptions.cancelDowngrade(user);
    }

    @PostMapping("/cancel")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(CurrentUser user) {
        subscriptions.cancel(user);
    }

    // ------------------------------------------------------------------ NewebPay callbacks

    @PostMapping("/newebpay/period-return")
    public ResponseEntity<Void> periodReturn(@RequestParam("Period") String period) {
        return redirect(safely(() -> subscriptions.onPeriodResult(period)));
    }

    @PostMapping("/newebpay/period-notify")
    public String periodNotify(@RequestParam("Period") String period) {
        subscriptions.onPeriodResult(period);
        return "OK";
    }

    @PostMapping("/newebpay/mpg-return")
    public ResponseEntity<Void> mpgReturn(@RequestParam("TradeInfo") String tradeInfo, @RequestParam("TradeSha") String tradeSha) {
        return redirect(safely(() -> subscriptions.onTradeResult(tradeInfo, tradeSha)));
    }

    @PostMapping("/newebpay/mpg-notify")
    public String mpgNotify(@RequestParam("TradeInfo") String tradeInfo, @RequestParam("TradeSha") String tradeSha) {
        subscriptions.onTradeResult(tradeInfo, tradeSha);
        return "OK";
    }

    /**
     * The shopper always lands back in the app. If this copy of the result cannot be read, the
     * outcome is left to NewebPay's server notification ("pending"), never reported as a failure.
     */
    private static String safely(java.util.function.BooleanSupplier handle) {
        try {
            return handle.getAsBoolean() ? "success" : "failed";
        } catch (Exception e) {
            log.error("NewebPay return could not be processed", e);
            return "pending";
        }
    }

    private ResponseEntity<Void> redirect(String result) {
        return ResponseEntity.status(HttpStatus.SEE_OTHER).location(URI.create(subscriptions.returnUrl(result))).build();
    }
}
