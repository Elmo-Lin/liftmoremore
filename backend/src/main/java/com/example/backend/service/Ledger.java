package com.example.backend.service;

import com.example.backend.common.Domain;
import com.example.backend.domain.SessionPackage;
import com.example.backend.domain.SessionTransaction;
import com.example.backend.web.Dtos.BalanceDto;
import com.example.backend.web.Dtos.PackageBalanceDto;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Balance derivation — the single source of truth (same rules as frontend/src/lib/sessions.ts):
 * remaining = totalSessions + Σ adjustments − (deductions − reversals).
 */
public final class Ledger {

    private Ledger() {}

    public record PackageBalance(SessionPackage pkg, int total, int used, int adjusted, int remaining) {}

    public static PackageBalance of(SessionPackage pkg, List<SessionTransaction> all) {
        int used = 0;
        int adjusted = 0;
        for (SessionTransaction t : all) {
            if (!pkg.id.equals(t.packageId)) continue;
            if (Domain.TX_ADJUSTMENT.equals(t.type)) adjusted += t.delta;
            else used -= t.delta; // deduction: -1 → used +1; reversal: +1 → used −1
        }
        return new PackageBalance(pkg, pkg.totalSessions, used, adjusted, pkg.totalSessions + adjusted - used);
    }

    /** Packages ordered by purchase date; deductions consume the oldest package with sessions left. */
    public static List<PackageBalance> balances(List<SessionPackage> packages, List<SessionTransaction> txs) {
        return packages.stream()
                .sorted(Comparator.comparing((SessionPackage p) -> p.purchaseDate).thenComparing(p -> p.id))
                .map(p -> of(p, txs))
                .toList();
    }

    public static Optional<PackageBalance> nextPackage(List<PackageBalance> balances) {
        return balances.stream().filter(b -> b.remaining() > 0).findFirst();
    }

    /** Net ledger effect on one workout; negative means it is currently deducted. */
    public static int netForWorkout(String workoutId, List<SessionTransaction> txs) {
        return txs.stream().filter(t -> workoutId.equals(t.workoutId)).mapToInt(t -> t.delta).sum();
    }

    public static BalanceDto toDto(String studentId, List<PackageBalance> balances) {
        return new BalanceDto(
                studentId,
                balances.stream().mapToInt(PackageBalance::remaining).sum(),
                balances.stream().mapToInt(PackageBalance::total).sum(),
                balances.stream().mapToInt(PackageBalance::used).sum(),
                balances.stream().map(b -> new PackageBalanceDto(b.pkg().id, b.total(), b.used(), b.adjusted(), b.remaining())).toList(),
                nextPackage(balances).map(b -> b.pkg().id).orElse(null));
    }
}
